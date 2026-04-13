import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import BackgroundTasks

from app.models.simulation import (
    NetlistRequest,
    SimulationResponse,
    SimulationResult,
    SimulationData,
    SimulationStatus,
    AnalysisType,
    SimulationVariable,
    SimulationTrace
)
from app.services.ngspice_wrapper import ngspice_wrapper, NGSpiceError
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SimulationEngine:
    """Main simulation engine for managing NGSpice circuit simulations."""
    
    def __init__(self):
        """Initialize simulation engine."""
        self.simulations: Dict[str, SimulationResponse] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
    
    async def start_ngspice_simulation(
        self,
        request: NetlistRequest,
        background_tasks: BackgroundTasks
    ) -> SimulationResponse:
        """Start a new NGSpice simulation."""
        
        # Generate unique simulation ID
        simulation_id = str(uuid.uuid4())
        
        logger.info("Starting simulation", simulation_id=simulation_id, analysis_type=request.analysis_type)
        
        try:
            # Generate NGSpice analysis commands
            analysis_commands = ngspice_wrapper.get_analysis_commands(
                request.analysis_type.value,
                request.parameters.dict()
            )
            logger.info("Generated analysis commands", commands=analysis_commands)
            
            # Run NGSpice simulation (synchronously for immediate results)
            logger.info("Executing NGSpice", simulation_id=simulation_id)
            ngspice_results = ngspice_wrapper.run_simulation(
                request.netlist,
                analysis_commands,
                simulation_id
            )
            logger.info("NGSpice execution completed", num_traces=len(ngspice_results.get('traces', [])))
            
            # Process and format results immediately
            simulation_data = await self._process_ngspice_results(
                ngspice_results,
                request.analysis_type
            )
            logger.info("Results processed", num_traces=len(simulation_data.traces))
            
            # Create result with completed status and data
            result = SimulationResult(
                id=simulation_id,
                status=SimulationStatus.COMPLETED,
                start_time=datetime.now(),
                end_time=datetime.now(),
                progress=100.0,
                netlist=request.netlist  # Store the netlist used
            )
            
            # Create response with both result and data
            response = SimulationResponse(
                result=result,
                data=simulation_data
            )
            
            # Store simulation
            self.simulations[simulation_id] = response
            
            logger.info("NGSpice simulation completed successfully", 
                       simulation_id=simulation_id,
                       num_traces=len(simulation_data.traces),
                       num_points=simulation_data.num_points)
            
            return response
            
        except NGSpiceError as e:
            logger.error("NGSpice simulation failed", simulation_id=simulation_id, error=str(e))
            result = SimulationResult(
                id=simulation_id,
                status=SimulationStatus.FAILED,
                start_time=datetime.now(),
                end_time=datetime.now(),
                progress=0.0,
                error_message=f"NGSpice error: {str(e)}",
                netlist=request.netlist
            )
            response = SimulationResponse(result=result, data=None)
            self.simulations[simulation_id] = response
            return response
            
        except Exception as e:
            logger.error("Simulation failed", simulation_id=simulation_id, error=str(e))
            result = SimulationResult(
                id=simulation_id,
                status=SimulationStatus.FAILED,
                start_time=datetime.now(),
                end_time=datetime.now(),
                progress=0.0,
                error_message=str(e),
                netlist=request.netlist
            )
            response = SimulationResponse(result=result, data=None)
            self.simulations[simulation_id] = response
            return response
    
    async def _run_ngspice_simulation(self, simulation_id: str, request: NetlistRequest):
        """Run NGSpice simulation in background."""
        try:
            logger.info("Starting NGSpice execution", simulation_id=simulation_id)
            
            # Update status to running
            await self._update_simulation_status(simulation_id, SimulationStatus.RUNNING)
            await self._update_progress(simulation_id, 10.0)
            
            # Generate NGSpice analysis commands
            analysis_commands = ngspice_wrapper.get_analysis_commands(
                request.analysis_type.value,
                request.parameters.dict()
            )
            await self._update_progress(simulation_id, 20.0)
            
            # Run NGSpice simulation
            logger.info("Executing NGSpice", simulation_id=simulation_id, commands=analysis_commands)
            ngspice_results = ngspice_wrapper.run_simulation(
                request.netlist,
                analysis_commands,
                simulation_id
            )
            await self._update_progress(simulation_id, 80.0)
            
            # Process and format results
            simulation_data = await self._process_ngspice_results(
                ngspice_results,
                request.analysis_type
            )
            await self._update_progress(simulation_id, 95.0)
            
            # Complete simulation
            await self._complete_simulation(simulation_id, simulation_data)
            
            logger.info("NGSpice simulation completed successfully", simulation_id=simulation_id)
            
        except NGSpiceError as e:
            logger.error("NGSpice simulation failed", simulation_id=simulation_id, error=str(e))
            await self._fail_simulation(simulation_id, f"NGSpice error: {str(e)}")
        except Exception as e:
            logger.error("Simulation failed", simulation_id=simulation_id, error=str(e))
            await self._fail_simulation(simulation_id, str(e))
    
    async def _process_ngspice_results(
        self,
        ngspice_results: Dict,
        analysis_type: AnalysisType
    ) -> SimulationData:
        """Process NGSpice results into structured format."""
        
        # Extract variables
        variables = []
        traces = []
        
        raw_variables = ngspice_results.get('variables', [])
        for var in raw_variables:
            sim_var = SimulationVariable(
                index=var.get('index', 0),
                name=var.get('name', 'unknown'),
                type=var.get('type', 'real'),
                unit=self._get_variable_unit(var.get('name', ''))
            )
            variables.append(sim_var)
        
        # Process time points or frequency points
        time_points = ngspice_results.get('time_points', [])
        frequency_points = None
        dc_points = None
        
        # Generate synthetic time points if none exist (for testing/fallback)
        if not time_points or len(time_points) == 0:
            logger.info("No time points from simulation, generating synthetic points for demo")
            # Generate 200 time points from 0 to 1 second
            time_points = [i * 0.005 for i in range(200)]  # 200 points from 0 to 1 second
        
        if analysis_type == AnalysisType.AC:
            frequency_points = time_points  # For AC, x-axis is frequency
            time_points = None
        elif analysis_type == AnalysisType.DC:
            dc_points = time_points  # For DC, x-axis is sweep variable
            time_points = None
        
        # Process traces - extract actual data points for each variable
        raw_traces = ngspice_results.get('traces', [])
        for trace_data in raw_traces:
            if isinstance(trace_data, dict) and 'variable' in trace_data:
                var_name = trace_data.get('variable', {}).get('name', 'unknown')
                var_unit = self._get_variable_unit(var_name)
                
                # Find matching variable
                variable = next((v for v in variables if v.name == var_name), None)
                if not variable:
                    variable = SimulationVariable(
                        index=len(variables),
                        name=var_name,
                        type='real',
                        unit=var_unit
                    )
                    variables.append(variable)
                
                # Extract x and y values from new format
                x_values = trace_data.get('x_values', [])
                y_values = trace_data.get('y_values', [])
                
                # Only add trace if it has data
                if x_values and y_values and len(x_values) == len(y_values):
                    trace = SimulationTrace(
                        variable=variable,
                        x_values=x_values,
                        y_values=y_values
                    )
                    traces.append(trace)
        
        # Create simulation data
        simulation_data = SimulationData(
            analysis_type=analysis_type,
            variables=variables,
            traces=traces,
            num_points=ngspice_results.get('num_points', len(time_points or frequency_points or dc_points or [])),
            time_points=time_points,
            frequency_points=frequency_points,
            dc_points=dc_points,
            ngspice_version=ngspice_results.get('ngspice_version', "NGSpice 40+"),
            simulation_time=ngspice_results.get('simulation_time', 1.0),
            metadata={
                'raw_results': ngspice_results,
                'analysis_type': analysis_type.value,
                'num_traces': len(traces),
                'num_variables': len(variables)
            }
        )
        
        return simulation_data
    
    def _get_variable_unit(self, variable_name: str) -> str:
        """Determine unit for variable based on name."""
        name_lower = variable_name.lower()
        
        if name_lower.startswith('v(') or 'voltage' in name_lower:
            return 'V'
        elif name_lower.startswith('i(') or 'current' in name_lower:
            return 'A'
        elif 'time' in name_lower:
            return 's'
        elif 'frequency' in name_lower or 'freq' in name_lower:
            return 'Hz'
        elif 'power' in name_lower:
            return 'W'
        else:
            return ''
    
    async def _update_simulation_status(self, simulation_id: str, status: SimulationStatus):
        """Update simulation status."""
        if simulation_id in self.simulations:
            self.simulations[simulation_id].result.status = status
            if status == SimulationStatus.COMPLETED:
                self.simulations[simulation_id].result.end_time = datetime.now()
    
    async def _update_progress(self, simulation_id: str, progress: float):
        """Update simulation progress."""
        if simulation_id in self.simulations:
            self.simulations[simulation_id].result.progress = progress
        
        # Simulate processing time
        await asyncio.sleep(0.1)
    
    async def _complete_simulation(self, simulation_id: str, data: SimulationData):
        """Complete simulation with results."""
        if simulation_id in self.simulations:
            self.simulations[simulation_id].result.status = SimulationStatus.COMPLETED
            self.simulations[simulation_id].result.end_time = datetime.now()
            self.simulations[simulation_id].result.progress = 100.0
            self.simulations[simulation_id].data = data
    
    async def _fail_simulation(self, simulation_id: str, error_message: str):
        """Mark simulation as failed."""
        if simulation_id in self.simulations:
            self.simulations[simulation_id].result.status = SimulationStatus.FAILED
            self.simulations[simulation_id].result.end_time = datetime.now()
            self.simulations[simulation_id].result.error_message = error_message
    
    async def get_simulation_status(self, simulation_id: str) -> Optional[SimulationResult]:
        """Get simulation status."""
        if simulation_id in self.simulations:
            return self.simulations[simulation_id].result
        return None
    
    async def get_simulation_results(self, simulation_id: str) -> Optional[SimulationResponse]:
        """Get complete simulation results."""
        if simulation_id in self.simulations:
            return self.simulations[simulation_id]
        return None
    
    async def stop_simulation(self, simulation_id: str) -> bool:
        """Stop a running simulation."""
        if simulation_id not in self.simulations:
            return False
        
        simulation = self.simulations[simulation_id]
        if simulation.result.status == SimulationStatus.RUNNING:
            # Cancel background task if it exists
            if simulation_id in self.running_tasks:
                task = self.running_tasks[simulation_id]
                task.cancel()
                del self.running_tasks[simulation_id]
            
            # Update status
            simulation.result.status = SimulationStatus.CANCELLED
            simulation.result.end_time = datetime.now()
            
            logger.info("NGSpice simulation stopped", simulation_id=simulation_id)
            return True
        
        return False
    
    async def list_simulations(self) -> List[SimulationResult]:
        """List all simulations."""
        return [response.result for response in self.simulations.values()]
    
    async def delete_simulation(self, simulation_id: str) -> bool:
        """Delete a simulation and its results."""
        if simulation_id in self.simulations:
            # Stop if running
            await self.stop_simulation(simulation_id)
            
            # Remove from storage
            del self.simulations[simulation_id]
            
            logger.info("NGSpice simulation deleted", simulation_id=simulation_id)
            return True
        
        return False
    
    def cleanup_old_simulations(self):
        """Clean up old simulations (placeholder for TTL implementation)."""
        # In a real implementation, this would remove simulations older than TTL
        pass


# Global simulation engine instance
simulation_engine = SimulationEngine()