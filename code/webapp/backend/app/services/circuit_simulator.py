"""Circuit simulation engine using PySpice with async support"""
import numpy as np
from typing import Dict, Any, List, Callable, Optional, Union
from dataclasses import dataclass
import asyncio

from app.core.logging import get_logger

logger = get_logger(__name__)

# Import PySpice at module level
try:
    from PySpice.Unit import *
    PYSPICE_AVAILABLE = True
except ImportError:
    PYSPICE_AVAILABLE = False
    logger.warning("PySpice not available, using theoretical simulation only")


@dataclass
class SimulationPoint:
    """Single simulation data point"""
    time: float
    v1: float
    v2: float
    v3: float
    v_r: float
    v_l: float
    v_c: float
    i_circuit: float
    p_r: float
    p_l: float
    p_c: float


class CircuitSimulator:
    """Simulates RLC circuits with async support"""
    
    def __init__(self):
        """Initialize simulator with default parameters"""
        self.default_R = 10
        self.default_L = 1e-3
        self.default_C = 20e-6
        self.default_V = 5
        logger.info("CircuitSimulator initialized")

    def extract_parameters(self, circuit_json: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract circuit parameters from circuit JSON
        
        Args:
            circuit_json: Circuit JSON data
            
        Returns:
            Dictionary with R, L, C, V parameters
        """
        params = {
            'R': self.default_R,
            'L': self.default_L,
            'C': self.default_C,
            'V': self.default_V
        }
        
        try:
            # Try to extract from components
            for comp in circuit_json.get('components', []):
                comp_type = comp.get('type', '').lower()
                value_str = comp.get('value', '').lower()
                
                if 'resistor' in comp_type and value_str:
                    try:
                        value = float(value_str.replace('ω', '').replace('ohm', '').strip())
                        params['R'] = value
                        logger.debug(f"Extracted resistor value: {value} Ω")
                    except:
                        pass
                elif 'capacitor' in comp_type and value_str:
                    try:
                        value = float(value_str.replace('μf', '').replace('uf', '').strip())
                        params['C'] = value * 1e-6
                        logger.debug(f"Extracted capacitor value: {value*1e6} µF")
                    except:
                        pass
                elif 'inductor' in comp_type and value_str:
                    try:
                        value = float(value_str.replace('mh', '').replace('h', '').strip())
                        params['L'] = value * 1e-3 if 'mh' in value_str else value
                        logger.debug(f"Extracted inductor value: {value} H")
                    except:
                        pass
                elif 'voltage' in comp_type and value_str:
                    try:
                        value = float(value_str.replace('v', '').strip())
                        params['V'] = value
                        logger.debug(f"Extracted voltage value: {value} V")
                    except:
                        pass
        except Exception as e:
            logger.warning(f"Error extracting parameters: {str(e)}")
        
        return params

    async def simulate_async(
        self,
        circuit_json: Dict[str, Any],
        duration: float = 0.1,
        steps: int = 300,
        callback: Optional[Callable] = None
    ) -> List[SimulationPoint]:
        """
        Simulate circuit asynchronously with optional real-time streaming
        
        Args:
            circuit_json: Circuit JSON data
            duration: Simulation duration in seconds
            steps: Number of simulation steps
            callback: Optional async callback function for each data point
        
        Returns:
            List of simulation data points
        """
        params = self.extract_parameters(circuit_json)
        R = params['R']
        L = params['L']
        C = params['C']
        V = params['V']
        
        logger.info(f"Starting simulation: R={R}Ω, L={L}H, C={C}F, V={V}V")
        
        results = []
        time_array = np.linspace(0, duration, steps)
        
        try:
            if PYSPICE_AVAILABLE:
                # Try PySpice simulation
                results = await self._simulate_pyspice(R, L, C, V, time_array)
                logger.info(f"PySpice simulation completed with {len(results)} points")
            else:
                results = await self._simulate_theoretical(R, L, C, V, time_array)
                logger.info(f"Theoretical simulation completed with {len(results)} points")
        except Exception as e:
            logger.warning(f"Simulation error, falling back to theoretical: {str(e)}")
            results = await self._simulate_theoretical(R, L, C, V, time_array)
        
        # Stream results if callback provided
        if callback:
            for result in results:
                await callback(result)
                await asyncio.sleep(0.001)  # Small delay for streaming
        
        return results

    async def _simulate_pyspice(
        self,
        R: float,
        L: float,
        C: float,
        V: float,
        time_array: np.ndarray
    ) -> List[SimulationPoint]:
        """Run simulation using PySpice"""
        try:
            from PySpice.Spice.Netlist import Circuit
            
            # Build PySpice circuit
            circuit = Circuit('Series RLC')
            circuit.V('input', 1, circuit.gnd, V @ u_V)
            circuit.R('1', 1, 2, R @ u_Ω)
            circuit.L('1', 2, 3, L @ u_H)
            circuit.C('1', 3, circuit.gnd, C @ u_F)
            
            # Run transient simulation
            simulator = circuit.simulator(temperature=25, nominal_temperature=25)
            duration = time_array[-1]
            analysis = simulator.transient(
                step_time=(duration/len(time_array)) @ u_s, 
                end_time=duration @ u_s
            )
            
            # Extract results
            time = np.array(analysis.time)
            v1 = np.array(analysis['1'])
            v2 = np.array(analysis['2'])
            v3 = np.array(analysis['3'])
            
            v_r = v1 - v2
            v_l = v2 - v3
            v_c = v3
            i_circuit = v_r / (R + 1e-10)
            p_r = v_r * i_circuit
            p_l = v_l * i_circuit
            p_c = v_c * i_circuit
            
            results = [
                SimulationPoint(
                    time=float(time[i]),
                    v1=float(v1[i]),
                    v2=float(v2[i]),
                    v3=float(v3[i]),
                    v_r=float(v_r[i]),
                    v_l=float(v_l[i]),
                    v_c=float(v_c[i]),
                    i_circuit=float(i_circuit[i]),
                    p_r=float(p_r[i]),
                    p_l=float(p_l[i]),
                    p_c=float(p_c[i])
                )
                for i in range(len(time))
            ]
            
            return results
            
        except Exception as e:
            logger.warning(f"PySpice simulation failed: {str(e)}")
            raise

    async def _simulate_theoretical(
        self,
        R: float,
        L: float,
        C: float,
        V: float,
        time_array: np.ndarray
    ) -> List[SimulationPoint]:
        """Run theoretical RLC transient analysis"""
        results = []
        
        omega_0 = 1 / np.sqrt(L * C)
        zeta = R / (2 * np.sqrt(L / C))
        
        logger.info(f"Theoretical analysis: ω₀={omega_0:.2f} rad/s, ζ={zeta:.3f}")
        
        if zeta < 1:
            response_type = "Underdamped (Oscillatory)"
            omega_d = omega_0 * np.sqrt(1 - zeta**2)
            
            for t in time_array:
                v_c = V * (1 - np.exp(-zeta*omega_0*t) * 
                          (np.cos(omega_d*t) + (zeta/np.sqrt(1-zeta**2))*np.sin(omega_d*t)))
                i_circuit = C * V * omega_0 * np.exp(-zeta*omega_0*t) * np.sin(omega_d*t)
        
        elif zeta > 1:
            response_type = "Overdamped"
            r1 = -zeta*omega_0 + omega_0*np.sqrt(zeta**2-1)
            r2 = -zeta*omega_0 - omega_0*np.sqrt(zeta**2-1)
            
            for t in time_array:
                v_c = V * (1 - (r2/(r2-r1))*np.exp(r1*t) + (r1/(r2-r1))*np.exp(r2*t))
                i_circuit = V * C * ((r2/(r2-r1))*r1*np.exp(r1*t) - (r1/(r2-r1))*r2*np.exp(r2*t))
        
        else:
            response_type = "Critically Damped"
            
            for t in time_array:
                v_c = V * (1 - (1 + omega_0*t)*np.exp(-omega_0*t))
                i_circuit = V * omega_0**2 * t * np.exp(-omega_0*t)
        
        logger.info(f"Response type: {response_type}")
        
        # Generate points for all time steps
        for t in time_array:
            # Calculate voltages
            if zeta < 1:
                omega_d = omega_0 * np.sqrt(1 - zeta**2)
                v_c = V * (1 - np.exp(-zeta*omega_0*t) * 
                          (np.cos(omega_d*t) + (zeta/np.sqrt(1-zeta**2))*np.sin(omega_d*t)))
                i_circuit = C * V * omega_0 * np.exp(-zeta*omega_0*t) * np.sin(omega_d*t)
            elif zeta > 1:
                r1 = -zeta*omega_0 + omega_0*np.sqrt(zeta**2-1)
                r2 = -zeta*omega_0 - omega_0*np.sqrt(zeta**2-1)
                v_c = V * (1 - (r2/(r2-r1))*np.exp(r1*t) + (r1/(r2-r1))*np.exp(r2*t))
                i_circuit = V * C * ((r2/(r2-r1))*r1*np.exp(r1*t) - (r1/(r2-r1))*r2*np.exp(r2*t))
            else:
                v_c = V * (1 - (1 + omega_0*t)*np.exp(-omega_0*t))
                i_circuit = V * omega_0**2 * t * np.exp(-omega_0*t)
            
            v_r = i_circuit * R
            v_l = V - v_r - v_c
            p_r = v_r * i_circuit if R > 0 else 0
            p_l = v_l * i_circuit
            p_c = v_c * i_circuit
            
            point = SimulationPoint(
                time=float(t),
                v1=float(V),
                v2=float(v_r + v_l),
                v3=float(v_c),
                v_r=float(v_r),
                v_l=float(v_l),
                v_c=float(v_c),
                i_circuit=float(i_circuit),
                p_r=float(p_r),
                p_l=float(p_l),
                p_c=float(p_c)
            )
            results.append(point)
        
        return results

    async def simulate_async_netlist(
        self,
        netlist: Union[Dict[str, Any], str],
        duration: float = 0.1,
        steps: int = 300,
        callback: Optional[Callable] = None
    ) -> List[SimulationPoint]:
        """
        Simulate circuit from SPICE netlist format
        
        Args:
            netlist: SPICE netlist as dictionary or string
            duration: Simulation duration in seconds
            steps: Number of simulation steps
            callback: Optional async callback for streaming results
            
        Returns:
            List of simulation data points
        """
        logger.info("Starting netlist simulation")
        
        try:
            # Extract parameters from netlist
            params = self._extract_netlist_params(netlist)
            R = params['R']
            L = params['L']
            C = params['C']
            V = params['V']
            
            time_array = np.linspace(0, duration, steps)
            
            # Run theoretical analysis
            results = await self._simulate_theoretical(R, L, C, V, time_array)
            
            # Stream results if callback provided
            if callback:
                for result in results:
                    await callback(result)
                    await asyncio.sleep(0.001)
            
            logger.info(f"Netlist simulation completed with {len(results)} points")
            return results
            
        except Exception as e:
            logger.error(f"Netlist simulation failed: {str(e)}")
            raise

    def _extract_netlist_params(self, netlist: Union[Dict[str, Any], str]) -> Dict[str, float]:
        """Extract R, L, C, V parameters from netlist"""
        params = {
            'R': self.default_R,
            'L': self.default_L,
            'C': self.default_C,
            'V': self.default_V
        }
        
        try:
            if isinstance(netlist, dict):
                # Extract from dict netlist
                for component in netlist.get('components', []):
                    comp_type = component.get('type', '').lower()
                    value = component.get('value', 0)
                    
                    if 'resistor' in comp_type:
                        params['R'] = float(value)
                    elif 'capacitor' in comp_type:
                        params['C'] = float(value)
                    elif 'inductor' in comp_type:
                        params['L'] = float(value)
                    elif 'voltage' in comp_type:
                        params['V'] = float(value)
                
                # Check voltage at top level
                if 'voltage' in netlist:
                    params['V'] = float(netlist['voltage'])
            
            elif isinstance(netlist, str):
                # Parse SPICE netlist string (simplified)
                lines = netlist.split('\n')
                for line in lines:
                    line = line.strip().upper()
                    if line.startswith('V'):
                        try:
                            parts = line.split()
                            if len(parts) >= 4:
                                params['V'] = float(parts[3])
                        except:
                            pass
                    elif line.startswith('R'):
                        try:
                            parts = line.split()
                            if len(parts) >= 4:
                                params['R'] = float(parts[3])
                        except:
                            pass
                    elif line.startswith('L'):
                        try:
                            parts = line.split()
                            if len(parts) >= 4:
                                params['L'] = float(parts[3])
                        except:
                            pass
                    elif line.startswith('C'):
                        try:
                            parts = line.split()
                            if len(parts) >= 4:
                                params['C'] = float(parts[3])
                        except:
                            pass
        except Exception as e:
            logger.warning(f"Error extracting netlist parameters: {str(e)}")
        
        return params

    def _dict_to_netlist(self, netlist_dict: Dict[str, Any]) -> str:
        """Convert netlist dictionary to SPICE format string"""
        lines = ["Circuit", ""]
        
        # Add voltage source
        V = netlist_dict.get('voltage', self.default_V)
        lines.append(f"V1 1 0 DC {V}")
        
        # Add components
        for comp in netlist_dict.get('components', []):
            comp_type = comp.get('type', '').lower()
            value = comp.get('value', 0)
            name = comp.get('name', 'X')
            
            if 'resistor' in comp_type:
                lines.append(f"R1 1 2 {value}")
            elif 'inductor' in comp_type:
                lines.append(f"L1 2 3 {value}")
            elif 'capacitor' in comp_type:
                lines.append(f"C1 3 0 {value}")
        
        # Add analysis command
        lines.append(".tran 0 0.1 0 0.0001")
        lines.append(".end")
        
        return "\n".join(lines)

    def get_circuit_parameters(self, circuit_json: Dict[str, Any]) -> Dict[str, float]:
        """
        Analyze circuit and return key parameters
        
        Args:
            circuit_json: Circuit JSON data
            
        Returns:
            Dictionary with analyzed parameters
        """
        params = self.extract_parameters(circuit_json)
        R = params['R']
        L = params['L']
        C = params['C']
        V = params['V']
        
        # Calculate circuit parameters
        omega_0 = 1 / np.sqrt(L * C) if (L * C) > 0 else 0
        zeta = R / (2 * np.sqrt(L / C)) if (L / C) > 0 else 0
        Q = 1 / (2 * zeta) if zeta > 0 else float('inf')
        tau = R * C if R > 0 else float('inf')
        
        response_type = 'Underdamped' if zeta < 1 else 'Overdamped' if zeta > 1 else 'Critically Damped'
        
        return {
            'resistance': float(R),
            'inductance': float(L),
            'capacitance': float(C),
            'voltage': float(V),
            'natural_frequency_hz': float(omega_0 / (2 * np.pi)) if omega_0 > 0 else 0,
            'natural_frequency_rad_s': float(omega_0),
            'damping_ratio': float(zeta),
            'quality_factor': float(Q),
            'time_constant_ms': float(tau * 1000) if tau != float('inf') else 0,
            'response_type': response_type,
            'impedance_ohms': float(np.sqrt(L / C)) if (L * C) > 0 else 0
        }
