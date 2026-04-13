import os
import tempfile
import subprocess
import re
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)


class NGSpiceError(Exception):
    """Custom exception for NGSpice-related errors."""
    pass


class NGSpiceWrapper:
    """Wrapper for NGSpice circuit simulator."""
    
    def __init__(self):
        """Initialize NGSpice wrapper."""
        try:
            self.ngspice_executable = self._find_ngspice()
            self.temp_dir = Path(tempfile.gettempdir()) / "circuitron_simulations"
            self.temp_dir.mkdir(exist_ok=True)
            
            if self.ngspice_executable:
                logger.info("NGSpice wrapper initialized", executable=self.ngspice_executable)
            else:
                logger.warning("NGSpice wrapper initialized but NGSpice not found")
        except Exception as e:
            logger.error("Failed to initialize NGSpice wrapper", error=str(e))
            self.ngspice_executable = None
    
    def _find_ngspice(self) -> Optional[str]:
        """Find NGSpice executable on the system."""
        
        # Common NGSpice executable names and paths (prioritize console version)
        possible_names = ["ngspice_con.exe", "ngspice.exe", "ngspice"]
        possible_paths = [
            "",  # System PATH
            "C:\\Spice64\\bin\\",
            "C:\\Program Files\\Spice\\bin\\",
            "C:\\Program Files (x86)\\Spice\\bin\\",
            "C:\\Program Files\\NGSpice\\bin\\",
            "C:\\NGSpice\\bin\\",
            "/usr/bin/",
            "/usr/local/bin/",
            "/opt/ngspice/bin/",
        ]
        
        # First try with version check
        for path in possible_paths:
            for name in possible_names:
                executable = os.path.join(path, name) if path else name
                try:
                    result = subprocess.run(
                        [executable, "--version"],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    if result.returncode == 0:
                        version_info = result.stdout.strip()[:200] if result.stdout else "Unknown version"
                        logger.info("Found NGSpice with version check", path=executable, version=version_info)
                        return executable
                except (subprocess.SubprocessError, FileNotFoundError, OSError, subprocess.TimeoutExpired):
                    continue
        
        # Try direct paths without version check (fallback)
        direct_paths = [
            "C:\\Spice64\\bin\\ngspice_con.exe",
            "C:\\Spice64\\bin\\ngspice.exe"
        ]
        
        for executable in direct_paths:
            if os.path.exists(executable):
                logger.info("Found NGSpice (direct path check)", path=executable)
                return executable
        
        # NGSpice not found
        logger.warning("NGSpice not found on system")
        return None
    
    def is_available(self) -> bool:
        """Check if NGSpice is available."""
        return self.ngspice_executable is not None
    
    def get_installation_help(self) -> Dict[str, Any]:
        """Get NGSpice installation instructions."""
        return {
            "ngspice_found": self.is_available(),
            "current_executable": self.ngspice_executable,
            "installation_instructions": {
                "windows": {
                    "method_1": {
                        "title": "Download Official Binary",
                        "steps": [
                            "1. Go to http://ngspice.sourceforge.net/download.html",
                            "2. Download 'ngspice-45-win64.zip' (latest version)",
                            "3. Extract to C:\\Spice64\\",
                            "4. Add C:\\Spice64\\bin to your PATH environment variable",
                            "5. Restart command prompt and run 'ngspice_con --version'"
                        ],
                        "download_url": "https://sourceforge.net/projects/ngspice/files/ng-spice-rework/"
                    }
                }
            },
            "verification_command": "ngspice_con --version",
            "common_paths": [
                "C:\\Spice64\\bin\\ngspice_con.exe",
                "C:\\Spice64\\bin\\ngspice.exe"
            ]
        }
    
    def run_simulation(
        self,
        netlist: str,
        analysis_commands: List[str],
        simulation_id: str
    ) -> Dict[str, Any]:
        """Run NGSpice simulation with the given netlist and commands."""
        
        if not self.is_available():
            raise NGSpiceError(
                "NGSpice is not available. Please install NGSpice and ensure it's in your PATH."
            )
        
        logger.info("Starting NGSpice simulation", simulation_id=simulation_id)
        
        try:
            # Create temporary files
            netlist_file = self.temp_dir / f"{simulation_id}.cir"
            output_file = self.temp_dir / f"{simulation_id}.out"
            
            # Write netlist
            self._write_netlist(netlist_file, netlist, analysis_commands)
            
            # Run NGSpice
            result = self._execute_ngspice(netlist_file, output_file)
            
            # Parse results (pass netlist so we can extract nodes)
            simulation_data = self._parse_results(output_file, result, netlist)
            
            # Cleanup temporary files
            self._cleanup_files([netlist_file, output_file])
            
            logger.info("NGSpice simulation completed", simulation_id=simulation_id)
            
            return simulation_data
            
        except Exception as e:
            logger.error("NGSpice simulation failed", simulation_id=simulation_id, error=str(e))
            raise NGSpiceError(f"Simulation failed: {str(e)}")
    
    def _write_netlist(
        self,
        netlist_file: Path,
        netlist: str,
        analysis_commands: List[str]
    ) -> None:
        """Write netlist with analysis commands to file."""
        
        # Clean and validate netlist
        cleaned_netlist = self._clean_netlist(netlist)
        
        # Add control commands
        control_section = [
            ".control",
            "set ngbehavior=hsa",
            "set temp=27",
        ]
        control_section.extend(analysis_commands)
        control_section.append("print all")
        control_section.extend([
            "write",
            "quit",
            ".endc"
        ])
        
        # Combine netlist and control
        full_content = cleaned_netlist + "\n" + "\n".join(control_section) + "\n.end\n"
        
        # Write to file
        netlist_file.write_text(full_content, encoding='utf-8')
        
        logger.debug("Netlist written", file=str(netlist_file), size=len(full_content))
    
    def _clean_netlist(self, netlist: str) -> str:
        """Clean and validate SPICE netlist.
        
        Strips analysis directives (.tran, .dc, .ac, .op) and .end since
        analysis commands are added via the .control section instead.
        """
        lines = []
        # Analysis directives to strip (handled by control section)
        analysis_directives = ('.tran', '.dc', '.ac', '.op', '.end')
        
        for line in netlist.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            # Keep the first comment (title line), skip subsequent comments
            if line.startswith('*') and len(lines) > 0:
                continue
            # Strip analysis directives and .end
            if line.lower().startswith(analysis_directives):
                continue
            lines.append(line)
        
        # Ensure title line exists
        if not lines or not lines[0] or lines[0].startswith('.'):
            lines.insert(0, "Circuitron Circuit Simulation")
        
        return '\n'.join(lines)
    
    def _execute_ngspice(self, netlist_file: Path, output_file: Path) -> subprocess.CompletedProcess:
        """Execute NGSpice with the netlist."""
        cmd = [
            self.ngspice_executable,
            "-b",
            "-r", str(output_file),
            str(netlist_file)
        ]
        
        logger.debug("Executing NGSpice", command=" ".join(cmd))
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.max_simulation_time,
                cwd=self.temp_dir
            )
            
            logger.debug("NGSpice execution completed", 
                        return_code=result.returncode,
                        stdout_length=len(result.stdout) if result.stdout else 0,
                        stderr_length=len(result.stderr) if result.stderr else 0)
            
            return result
            
        except subprocess.TimeoutExpired:
            raise NGSpiceError(f"Simulation timed out after {settings.max_simulation_time} seconds")
        except subprocess.SubprocessError as e:
            raise NGSpiceError(f"Failed to execute NGSpice: {str(e)}")
    
    def _parse_results(self, output_file: Path, result: subprocess.CompletedProcess, netlist: str = "") -> Dict[str, Any]:
        """Parse NGSpice output and extract trace data."""
        import numpy as np
        
        # First check if simulation was successful
        execution_successful = result.returncode == 0
        
        # Try to parse the raw binary output file first, then ASCII from stdout
        traces = []
        time_points = []
        variables = []
        
        # First try ASCII parsing if stdout contains tabulated data
        if result.stdout and "Index" in result.stdout and "time" in result.stdout:
            try:
                logger.info("Found ASCII tabulated output in stdout, parsing...")
                traces, time_points, variables = self._parse_ascii_output(result.stdout, netlist)
                logger.debug("Parsed ASCII output", 
                           num_traces=len(traces),
                           num_time_points=len(time_points),
                           num_variables=len(variables))
            except Exception as e:
                logger.warning("Failed to parse ASCII output", error=str(e))
        
        # If ASCII parsing failed or no data, try binary parsing as fallback
        if not time_points or not traces:
            try:
                if output_file.exists() and output_file.stat().st_size > 0:
                    # Try to parse NGSpice raw binary output
                    logger.info("Attempting binary raw file parsing as fallback...")
                    traces, time_points, variables = self._parse_ngspice_raw(output_file)
                    
                    logger.debug("Parsed NGSpice raw output", 
                               num_traces=len(traces),
                               num_time_points=len(time_points),
                               num_variables=len(variables))
            except Exception as e:
                logger.warning("Failed to parse NGSpice raw output", error=str(e))
        
        # If both parsing methods failed, return empty results
        if not time_points or not traces:
            logger.warning("NGSpice simulation produced no parseable output data")
            logger.info("No synthetic data generation - returning empty results")
            time_points = []
            variables = []
            traces = []
        
        result_dict = {
            'time_points': time_points,
            'variables': variables,
            'traces': traces,
            'num_points': len(time_points) if time_points else 0,
            'status': 'completed' if execution_successful else 'failed',
            'execution_successful': execution_successful,
            'stdout': result.stdout[:1000] if result.stdout else '',
            'stderr': result.stderr[:1000] if result.stderr else ''
        }
        
        logger.debug("Parse results returning", 
                    num_traces=len(result_dict['traces']),
                    num_points=result_dict['num_points'],
                    num_variables=len(result_dict['variables']))
        
        return result_dict
    
    def _extract_nodes_from_netlist(self, netlist: str) -> List[str]:
        """Extract node numbers from SPICE netlist."""
        nodes = set()
        
        if not netlist:
            return []
        
        # Parse each line of netlist
        for line in netlist.split('\n'):
            line = line.strip()
            
            # Skip comments, empty lines, and commands
            if not line or line.startswith('*') or line.startswith('.'):
                continue
            
            # Parse component lines: X n1 n2 [n3...] [value] [params]
            parts = line.split()
            if len(parts) < 3:
                continue
            
            # Skip reference (first part like V1, R1, etc.)
            # Extract node numbers (typically 1-2 digit numbers after reference)
            for i, part in enumerate(parts[1:], 1):
                # Try to parse as number
                try:
                    num = int(part)
                    # Only accept reasonable node numbers (0-99, skip component values)
                    # Component values are typically > 100
                    if 0 <= num <= 99:
                        nodes.add(str(num))
                    else:
                        # We've hit a component value, stop parsing this line
                        break
                except ValueError:
                    # Hit a non-numeric part, stop parsing this line
                    break
        
        # Return sorted nodes (excluding 0 which is ground)
        sorted_nodes = sorted(list(nodes), key=lambda x: int(x))
        result_nodes = [n for n in sorted_nodes if n != '0']
        
        logger.debug(f"Extracted nodes from netlist: {result_nodes}")
        return result_nodes if result_nodes else []
    
    
    def _parse_ngspice_raw(self, output_file: Path) -> Tuple[List[Dict], List[float], List[Dict]]:
        """Parse NGSpice binary raw output file (.out).
        
        Raw file format:
        - Header with: Title, Date, Plotname, Flags, Variables, Points
        - Binary data section with float values (4 or 8 bytes)
        """
        import struct
        
        traces = []
        time_points = []
        variables = []
        
        try:
            with open(output_file, 'rb') as f:
                content = f.read()
            
            # Find the start of binary data after "Binary:\n" marker
            binary_marker = b'Binary:\n'
            header_end = content.find(binary_marker)
            if header_end == -1:
                # Try alternate marker
                binary_marker = b'Binary:\r\n'
                header_end = content.find(binary_marker)
            if header_end == -1:
                logger.debug("No 'Binary:' marker found in raw file")
                return [], [], []
            
            # Parse text header (everything before "Binary:\n")
            header_text = content[:header_end].decode('utf-8', errors='ignore')
            lines = header_text.split('\n')
            
            # Binary data starts right after the marker
            binary_data_offset = header_end + len(binary_marker)
            
            no_variables = 0
            no_points = 0
            variable_names = []
            is_real = True
            is_binary = False
            
            for line in lines:
                line_lower = line.lower().strip()
                
                if line_lower.startswith('no. variables:'):
                    no_variables = int(line.split(':')[1].strip())
                elif line_lower.startswith('no. points:'):
                    no_points = int(line.split(':')[1].strip())
                elif line_lower.startswith('variables:'):
                    # Start collecting variable names
                    continue
                elif 'binary' in line_lower:
                    is_binary = True
                elif 'real' in line_lower and 'complex' not in line_lower:
                    is_real = True
                
                # Parse variable definitions (index, name, type)
                if line.strip() and not line_lower.startswith('no.') and \
                   not line_lower.startswith('title') and \
                   not line_lower.startswith('date') and \
                   not line_lower.startswith('plotname') and \
                   not line_lower.startswith('flags') and \
                   not line_lower.startswith('variables:') and \
                   not line_lower.startswith('values:') and \
                   line.strip()[0].isdigit():
                    # Variable definition line: "1  time  s"
                    parts = line.split()
                    if len(parts) >= 2:
                        var_name = parts[1]
                        variable_names.append(var_name)
            
            if no_variables == 0 or no_points == 0:
                logger.debug("No variables or points found", 
                           no_vars=no_variables, no_pts=no_points)
                return [], [], []
            
            logger.debug("Raw file header parsed",
                       no_variables=no_variables,
                       no_points=no_points,
                       is_binary=is_binary,
                       is_real=is_real,
                       num_var_names=len(variable_names))
            
            # Parse binary data
            binary_data = content[binary_data_offset:]
            
            # Determine float size (usually 8 bytes for double precision)
            float_size = 8
            expected_size = no_variables * no_points * float_size
            
            if len(binary_data) < expected_size:
                # Try 4-byte floats
                float_size = 4
                expected_size = no_variables * no_points * float_size
            
            if len(binary_data) < expected_size:
                logger.warning("Insufficient binary data",
                             expected=expected_size,
                             actual=len(binary_data))
                return [], [], []
            
            # Read float values
            # NGSpice raw binary stores data row-major: all variables for point 0,
            # then all variables for point 1, etc.
            values = []
            for i in range(no_variables * no_points):
                if float_size == 8:
                    val = struct.unpack('<d', binary_data[i*8:(i+1)*8])[0]
                else:
                    val = struct.unpack('<f', binary_data[i*4:(i+1)*4])[0]
                values.append(val)
            
            # Reshape data: row-major — [point0_var0, point0_var1, ..., point1_var0, point1_var1, ...]
            data_2d = []
            for point_idx in range(no_points):
                point_data = []
                for var_idx in range(no_variables):
                    idx = point_idx * no_variables + var_idx
                    if idx < len(values):
                        point_data.append(values[idx])
                data_2d.append(point_data)
            
            # First variable is typically time
            time_points = [point[0] for point in data_2d]
            
            # Create variable metadata
            for idx, var_name in enumerate(variable_names[:no_variables]):
                var_meta = {
                    'index': idx + 1,
                    'name': var_name,
                    'type': 'voltage' if var_name.startswith('v(') else 'current' if var_name.startswith('i(') else 'unknown',
                    'unit': self._get_variable_unit(var_name)
                }
                variables.append(var_meta)
            
            # Create traces for each variable (skip time which is index 0)
            for var_idx in range(1, min(len(variable_names), no_variables)):
                var_name = variable_names[var_idx]
                x_values = []
                y_values = []
                
                for point_idx, time_val in enumerate(time_points):
                    if point_idx < len(data_2d):
                        y_val = data_2d[point_idx][var_idx] if var_idx < len(data_2d[point_idx]) else 0
                        x_values.append(float(time_val))
                        y_values.append(float(y_val))
                
                if x_values and y_values:
                    trace = {
                        'variable': {
                            'index': var_idx,
                            'name': var_name,
                            'type': 'voltage' if var_name.startswith('v(') else 'current' if var_name.startswith('i(') else 'unknown',
                            'unit': self._get_variable_unit(var_name)
                        },
                        'x_values': x_values,
                        'y_values': y_values
                    }
                    traces.append(trace)
            
            logger.debug("Successfully parsed raw file",
                       num_traces=len(traces),
                       num_points=len(time_points),
                       variables=len(variables))
            
            return traces, time_points, variables
            
        except Exception as e:
            logger.error("Failed to parse raw file", error=str(e), exc_info=True)
            return [], [], []

    def _parse_ascii_output(self, stdout: str, netlist: str = "") -> Tuple[List[Dict], List[float], List[Dict]]:
        """Parse NGSpice ASCII tabulated output from stdout.
        
        Expected format:
        Index   time            n1              n2              time            
        0       0.000000e+00    0.000000e+00    0.000000e+00    0.000000e+00    
        1       1.000000e-05    1.000000e-01    9.990010e-05    1.000000e-05    
        """
        traces = []
        time_points = []
        variables = []
        
        try:
            lines = stdout.strip().split('\n')
            
            # Find the header line (starts with Index)
            header_line = None
            data_start_idx = -1
            
            for i, line in enumerate(lines):
                if line.strip().startswith('Index') and 'time' in line:
                    header_line = line.strip()
                    data_start_idx = i + 2  # Skip header line and separator line
                    break
            
            if not header_line or data_start_idx == -1:
                logger.warning("Could not find ASCII data header in stdout")
                return [], [], []
            
            # Parse header to get variable names
            header_parts = header_line.split()
            var_names = []
            
            # Skip 'Index' and collect variable names
            for part in header_parts[1:]:
                if part and part not in var_names:
                    var_names.append(part)
            
            if not var_names:
                logger.warning("No variable names found in ASCII header")
                return [], [], []
            
            logger.debug("ASCII header parsed", variables=var_names)
            
            # Parse data lines
            data_rows = []
            for line in lines[data_start_idx:]:
                line = line.strip()
                if not line or not line[0].isdigit():
                    continue
                
                # Split by whitespace and convert to floats
                parts = line.split()
                if len(parts) >= len(var_names) + 1:  # +1 for index
                    try:
                        # Skip index (first column) and parse numeric values
                        values = [float(parts[i+1]) for i in range(len(var_names))]
                        data_rows.append(values)
                    except ValueError as e:
                        logger.debug("Skipping invalid data line", line=line, error=str(e))
                        continue
            
            if not data_rows:
                logger.warning("No valid data rows found in ASCII output")
                return [], [], []
            
            logger.debug("ASCII data parsed", num_rows=len(data_rows), num_vars=len(var_names))
            
            # Extract time points (assume first variable is time)
            time_points = [row[0] for row in data_rows]
            
            # Create variable metadata
            for idx, var_name in enumerate(var_names):
                var_meta = {
                    'index': idx + 1,
                    'name': var_name,
                    'type': 'voltage' if var_name.startswith('v(') or var_name.startswith('n') else 'current' if var_name.startswith('i(') else 'time' if 'time' in var_name else 'unknown',
                    'unit': self._get_variable_unit(var_name)
                }
                variables.append(var_meta)
            
            # Create traces for each variable (skip time which is typically the first)
            for var_idx in range(1, len(var_names)):
                var_name = var_names[var_idx]
                x_values = []
                y_values = []
                
                for row_idx, time_val in enumerate(time_points):
                    if row_idx < len(data_rows) and var_idx < len(data_rows[row_idx]):
                        y_val = data_rows[row_idx][var_idx]
                        x_values.append(float(time_val))
                        y_values.append(float(y_val))
                
                if x_values and y_values:
                    trace = {
                        'variable': {
                            'index': var_idx,
                            'name': var_name,
                            'type': 'voltage' if var_name.startswith('v(') or var_name.startswith('n') else 'current' if var_name.startswith('i(') else 'unknown',
                            'unit': self._get_variable_unit(var_name)
                        },
                        'x_values': x_values,
                        'y_values': y_values
                    }
                    traces.append(trace)
            
            logger.debug("ASCII output successfully parsed",
                       num_traces=len(traces),
                       num_points=len(time_points),
                       num_variables=len(variables))
            
            return traces, time_points, variables
            
        except Exception as e:
            logger.error("Failed to parse ASCII output", error=str(e), exc_info=True)
            return [], [], []

    
    def _cleanup_files(self, files: List[Path]) -> None:
        """Clean up temporary files."""
        for file in files:
            try:
                if file.exists():
                    file.unlink()
            except Exception as e:
                logger.warning("Failed to cleanup file", file=str(file), error=str(e))
    
    def _extract_component_values(self, netlist: str) -> tuple[list[float], list[float]]:
        """Extract voltage sources and resistor values from netlist for realistic simulation."""
        voltage_sources = []
        resistors = []
        
        try:
            lines = netlist.strip().split('\n')
            for line in lines:
                line = line.strip()
                if not line or line.startswith('*'):
                    continue
                
                # Extract voltage sources (V<name> n1 n2 DC voltage)
                if line.upper().startswith('V'):
                    parts = line.split()
                    # Look for DC keyword and voltage value after it
                    for i, part in enumerate(parts):
                        if part.upper() == 'DC' and i + 1 < len(parts):
                            try:
                                voltage = float(parts[i + 1])
                                voltage_sources.append(voltage)
                                logger.info(f"Extracted voltage source: {voltage}V")
                            except (ValueError, IndexError):
                                pass
                
                # Extract resistors (R<name> n1 n2 value)
                elif line.upper().startswith('R'):
                    parts = line.split()
                    if len(parts) >= 4:
                        try:
                            resistance = float(parts[3])
                            resistors.append(resistance)
                            logger.info(f"Extracted resistor: {resistance}Ω")
                        except (ValueError, IndexError):
                            pass
        except Exception as e:
            logger.warning(f"Could not extract component values: {e}")
        
        return voltage_sources, resistors

    def validate_netlist(self, netlist: str) -> Tuple[bool, List[str]]:
        """Enhanced SPICE netlist validation."""
        issues = []
        lines = netlist.strip().split('\n')
        
        if not lines:
            issues.append("Netlist is empty")
            return False, issues
        
        # Check for title line
        if not lines[0] or lines[0].strip().startswith('.'):
            issues.append("Netlist should start with a title line")
        
        # Track components and nodes
        components = []
        nodes_used = set()
        has_ground = False
        
        for line_num, line in enumerate(lines[1:], 2):  # Skip title line
            line = line.strip()
            if not line or line.startswith('*'):
                continue
            
            if line.startswith('.'):
                continue  # Skip SPICE commands
            
            # Parse component line
            parts = line.split()
            if len(parts) < 3:
                if not line.startswith('.'):
                    issues.append(f"Line {line_num}: Invalid component definition - insufficient parameters")
                continue
            
            component_name = parts[0].upper()
            component_type = component_name[0] if component_name else ''
            
            if component_type in 'RLCVIE':
                components.append(component_name)
                
                # Validate component syntax based on type
                if component_type in 'RLC':  # Passive components: R1 n1 n2 value
                    if len(parts) < 4:
                        issues.append(f"Line {line_num}: {component_name} missing value")
                    else:
                        # Check nodes
                        try:
                            node1, node2 = parts[1], parts[2]
                            nodes_used.add(node1)
                            nodes_used.add(node2)
                            if node1 == '0' or node2 == '0':
                                has_ground = True
                            
                            # Validate component value
                            value = parts[3]
                            if not self._validate_component_value(value, component_type):
                                issues.append(f"Line {line_num}: Invalid {component_type.lower()} value '{value}'")
                        except Exception:
                            issues.append(f"Line {line_num}: Invalid node specification for {component_name}")
                
                elif component_type in 'VI':  # Sources: V1 n1 n2 DC value
                    if len(parts) < 5:
                        issues.append(f"Line {line_num}: {component_name} missing parameters")
                    else:
                        try:
                            node1, node2 = parts[1], parts[2]
                            nodes_used.add(node1)
                            nodes_used.add(node2)
                            if node1 == '0' or node2 == '0':
                                has_ground = True
                            
                            # Check for DC keyword and value
                            if 'DC' in [p.upper() for p in parts]:
                                dc_idx = next(i for i, p in enumerate(parts) if p.upper() == 'DC')
                                if dc_idx + 1 < len(parts):
                                    value = parts[dc_idx + 1]
                                    if not self._validate_numeric_value(value):
                                        issues.append(f"Line {line_num}: Invalid DC value '{value}' for {component_name}")
                        except Exception:
                            issues.append(f"Line {line_num}: Invalid source specification for {component_name}")
            else:
                if not line.startswith('.'):
                    issues.append(f"Line {line_num}: Unknown component type '{component_type}'")
        
        # Check for components
        if not components:
            issues.append("Netlist should contain circuit elements")
        
        # Check for ground reference
        if not has_ground:
            issues.append("Circuit must have a ground reference (node 0)")
        
        return len(issues) == 0, issues

    def _validate_component_value(self, value: str, component_type: str) -> bool:
        """Validate component value format."""
        import re
        
        # Allow scientific notation, decimals, and unit suffixes
        pattern = r'^[\d.]+([eE][+-]?\d+)?[fpnumkMGT]?$'
        
        try:
            # Remove unit suffixes for validation
            clean_value = re.sub(r'[fpnumkMGT]$', '', value)
            float(clean_value)
            return True
        except ValueError:
            return False

    def _validate_numeric_value(self, value: str) -> bool:
        """Validate numeric value (for voltage/current sources)."""
        try:
            float(value)
            return True
        except ValueError:
            return False
    
    def get_analysis_commands(self, analysis_type: str, parameters: Dict[str, Any]) -> List[str]:
        """Generate NGSpice analysis commands."""
        commands = []
        
        # Helper to get param with fallback (handles explicit None values)
        def _get(key, default):
            val = parameters.get(key)
            return val if val is not None else default
        
        if analysis_type.lower() == 'transient':
            start_time = _get('start_time', 0)
            end_time = _get('end_time', 1)
            time_step = _get('time_step', 0.001)
            commands.append(f"tran {time_step} {end_time} {start_time}")
            
        elif analysis_type.lower() == 'dc':
            source = _get('sweep_source', None)
            if source:
                start_val = _get('start_value', 0)
                end_val = _get('end_value', 5)
                step_val = _get('step_value', 0.1)
                commands.append(f"dc {source} {start_val} {end_val} {step_val}")
            else:
                commands.append("op")
                
        elif analysis_type.lower() == 'ac':
            start_freq = _get('start_frequency', 1)
            end_freq = _get('end_frequency', 1000)
            points_per_decade = _get('points_per_decade', 10)
            commands.append(f"ac dec {points_per_decade} {start_freq} {end_freq}")
        
        return commands

    def _get_variable_unit(self, variable_name: str) -> str:
        """Determine unit for variable based on name."""
        name_lower = variable_name.lower()
        
        if 'time' in name_lower:
            return 's'
        elif name_lower.startswith('v(') or name_lower.startswith('n'):
            return 'V'
        elif name_lower.startswith('i('):
            return 'A'
        elif 'frequency' in name_lower or 'freq' in name_lower:
            return 'Hz'
        elif 'power' in name_lower:
            return 'W'
        else:
            return 'V'  # Default to voltage for node names


# Global NGSpice wrapper instance
ngspice_wrapper = NGSpiceWrapper()