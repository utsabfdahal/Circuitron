from typing import Dict, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from fastapi.responses import JSONResponse

from app.models.simulation import (
    NetlistRequest,
    SimulationResponse, 
    SimulationResult,
    SimulationStatus,
    NetlistValidationResult
)
from app.services.ngspice_simulation_engine import simulation_engine
from app.services.ngspice_wrapper import ngspice_wrapper
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("/simulate", response_model=SimulationResponse)
async def run_simulation(
    request: NetlistRequest,
    background_tasks: BackgroundTasks
) -> SimulationResponse:
    """Run a circuit simulation with SPICE netlist."""
    try:
        logger.info(
            "Starting NGSpice simulation",
            analysis_type=request.analysis_type,
            netlist_length=len(request.netlist)
        )
        
        # Validate netlist first
        is_valid, issues = ngspice_wrapper.validate_netlist(request.netlist)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid netlist: {'; '.join(issues)}"
            )
        
        # Start simulation
        result = await simulation_engine.start_ngspice_simulation(request, background_tasks)
        
        logger.info("NGSpice simulation started successfully", simulation_id=result.result.id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to start NGSpice simulation", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start simulation: {str(e)}"
        )


@router.post("/validate", response_model=NetlistValidationResult)
async def validate_netlist(request: Dict[str, str]) -> NetlistValidationResult:
    """Validate SPICE netlist syntax."""
    try:
        netlist = request.get("netlist", "")
        if not netlist:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Netlist is required"
            )
        
        is_valid, issues = ngspice_wrapper.validate_netlist(netlist)
        
        # Add warnings for common issues
        warnings = []
        if "ground" not in netlist.lower() and "gnd" not in netlist.lower():
            warnings.append("No ground reference found - ensure circuit has ground connection")
        
        logger.info("Netlist validation completed", is_valid=is_valid, num_issues=len(issues))
        
        return NetlistValidationResult(
            is_valid=is_valid,
            issues=issues,
            warnings=warnings
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Netlist validation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )


@router.get("/{simulation_id}/status", response_model=SimulationResult)
async def get_simulation_status(simulation_id: str) -> SimulationResult:
    """Get simulation status and progress."""
    try:
        result = await simulation_engine.get_simulation_status(simulation_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation {simulation_id} not found"
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get simulation status", simulation_id=simulation_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get simulation status: {str(e)}"
        )


@router.get("/{simulation_id}/results", response_model=SimulationResponse)
async def get_simulation_results(simulation_id: str) -> SimulationResponse:
    """Get simulation results."""
    try:
        response = await simulation_engine.get_simulation_results(simulation_id)
        
        if not response:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation {simulation_id} not found"
            )
        
        if response.result.status == SimulationStatus.RUNNING:
            raise HTTPException(
                status_code=status.HTTP_202_ACCEPTED,
                detail="Simulation is still running"
            )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get simulation results", simulation_id=simulation_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get simulation results: {str(e)}"
        )


@router.post("/{simulation_id}/stop")
async def stop_simulation(simulation_id: str) -> JSONResponse:
    """Stop a running simulation."""
    try:
        success = await simulation_engine.stop_simulation(simulation_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation {simulation_id} not found or already stopped"
            )
        
        logger.info("Simulation stopped", simulation_id=simulation_id)
        
        return JSONResponse(
            content={"message": f"Simulation {simulation_id} stopped successfully"},
            status_code=status.HTTP_200_OK
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to stop simulation", simulation_id=simulation_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop simulation: {str(e)}"
        )


@router.get("/", response_model=List[SimulationResult])
async def list_simulations() -> List[SimulationResult]:
    """List all simulations."""
    try:
        simulations = await simulation_engine.list_simulations()
        return simulations
        
    except Exception as e:
        logger.error("Failed to list simulations", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list simulations: {str(e)}"
        )


@router.delete("/{simulation_id}")
async def delete_simulation(simulation_id: str) -> JSONResponse:
    """Delete a simulation and its results."""
    try:
        success = await simulation_engine.delete_simulation(simulation_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation {simulation_id} not found"
            )
        
        logger.info("Simulation deleted", simulation_id=simulation_id)
        
        return JSONResponse(
            content={"message": f"Simulation {simulation_id} deleted successfully"},
            status_code=status.HTTP_200_OK
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete simulation", simulation_id=simulation_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete simulation: {str(e)}"
        )