from typing import Optional, Dict, List, Any, Tuple
from pydantic import BaseModel, Field, validator
from enum import Enum
from datetime import datetime


class AnalysisType(str, Enum):
    TRANSIENT = "transient"
    DC = "dc" 
    AC = "ac"
    OP = "op"  # Operating point


class SimulationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SimulationParameters(BaseModel):
    # Transient Analysis parameters
    start_time: Optional[float] = Field(None, description="Simulation start time (seconds)")
    end_time: Optional[float] = Field(None, description="Simulation end time (seconds)")
    time_step: Optional[float] = Field(None, description="Time step for transient analysis (seconds)")
    
    # DC Analysis parameters
    sweep_source: Optional[str] = Field(None, description="Source name for DC sweep (e.g., 'V1')")
    start_value: Optional[float] = Field(None, description="DC sweep start value")
    end_value: Optional[float] = Field(None, description="DC sweep end value")
    step_value: Optional[float] = Field(None, description="DC sweep step value")
    
    # AC Analysis parameters
    start_frequency: Optional[float] = Field(None, description="AC analysis start frequency (Hz)")
    end_frequency: Optional[float] = Field(None, description="AC analysis end frequency (Hz)")
    points_per_decade: Optional[int] = Field(None, description="Points per decade for AC analysis")
    
    # General parameters
    temperature: Optional[float] = Field(27.0, description="Simulation temperature (Celsius)")
    additional_commands: List[str] = Field(default_factory=list, description="Additional NGSpice commands")
    
    @validator('time_step')
    def validate_time_step(cls, v, values):
        if v is not None:
            if v <= 0:
                raise ValueError("Time step must be positive")
            start_time = values.get('start_time', 0)
            end_time = values.get('end_time')
            if end_time and v > (end_time - start_time):
                raise ValueError("Time step is too large for simulation duration")
        return v


class NetlistRequest(BaseModel):
    netlist: str = Field(..., description="SPICE netlist content", min_length=1)
    analysis_type: AnalysisType = Field(..., description="Type of analysis to perform")
    parameters: SimulationParameters = Field(default_factory=SimulationParameters, description="Analysis parameters")
    
    @validator('netlist')
    def validate_netlist_not_empty(cls, v):
        """Ensure netlist is not empty."""
        if not v.strip():
            raise ValueError("Netlist cannot be empty")
        return v.strip()


class SimulationVariable(BaseModel):
    """NGSpice simulation variable."""
    index: int = Field(..., description="Variable index in simulation")
    name: str = Field(..., description="Variable name (e.g., 'v(out)', 'i(r1)')")
    type: str = Field(..., description="Variable type ('voltage', 'current', 'time', etc.)")
    unit: str = Field(default="", description="Variable unit")


class SimulationTrace(BaseModel):
    """Simulation trace data for a single variable."""
    variable: SimulationVariable = Field(..., description="Variable information")
    x_values: List[float] = Field(..., description="X-axis values (time, frequency, etc.)")
    y_values: List[float] = Field(..., description="Y-axis values (voltage, current, etc.)")


class SimulationResult(BaseModel):
    """Simulation execution result."""
    id: str = Field(..., description="Unique simulation identifier")
    status: SimulationStatus = Field(..., description="Simulation status")
    start_time: datetime = Field(..., description="Simulation start timestamp")
    end_time: Optional[datetime] = Field(None, description="Simulation end timestamp")
    progress: float = Field(default=0.0, description="Simulation progress (0-100)", ge=0.0, le=100.0)
    error_message: Optional[str] = Field(None, description="Error message if failed")
    netlist: Optional[str] = Field(None, description="SPICE netlist used for simulation")


class SimulationData(BaseModel):
    """NGSpice simulation output data."""
    analysis_type: AnalysisType = Field(..., description="Analysis type performed")
    variables: List[SimulationVariable] = Field(..., description="Simulation variables")
    traces: List[SimulationTrace] = Field(..., description="Simulation trace data")
    num_points: int = Field(..., description="Number of data points")
    
    # Analysis-specific data
    time_points: Optional[List[float]] = Field(None, description="Time points for transient analysis")
    frequency_points: Optional[List[float]] = Field(None, description="Frequency points for AC analysis")
    dc_points: Optional[List[float]] = Field(None, description="DC sweep points")
    
    # Metadata
    ngspice_version: Optional[str] = Field(None, description="NGSpice version used")
    simulation_time: Optional[float] = Field(None, description="Simulation execution time (seconds)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional simulation metadata")


class SimulationResponse(BaseModel):
    """Complete simulation response."""
    result: SimulationResult = Field(..., description="Simulation execution info")
    data: Optional[SimulationData] = Field(None, description="Simulation output data")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class NetlistValidationResult(BaseModel):
    """Netlist validation result."""
    is_valid: bool = Field(..., description="Whether netlist is valid")
    issues: List[str] = Field(default_factory=list, description="List of validation issues")
    warnings: List[str] = Field(default_factory=list, description="List of warnings")


class SimulationJobStatus(BaseModel):
    """Simulation job status for monitoring."""
    simulation_id: str = Field(..., description="Simulation identifier")
    status: SimulationStatus = Field(..., description="Current status")
    progress: float = Field(..., description="Progress percentage")
    estimated_remaining_time: Optional[float] = Field(None, description="Estimated remaining time (seconds)")
    current_step: Optional[str] = Field(None, description="Current simulation step")


# ============= CIRCUIT DETECTION MODELS =============

class BoundingBox(BaseModel):
    """Bounding box coordinates from YOLO detection."""
    x1: float = Field(..., description="Top-left x coordinate")
    y1: float = Field(..., description="Top-left y coordinate")
    x2: float = Field(..., description="Bottom-right x coordinate")
    y2: float = Field(..., description="Bottom-right y coordinate")
    
    def center(self) -> Tuple[float, float]:
        """Get center of bounding box."""
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)
    
    def width(self) -> float:
        """Get bounding box width."""
        return self.x2 - self.x1
    
    def height(self) -> float:
        """Get bounding box height."""
        return self.y2 - self.y1


class Position(BaseModel):
    """Position in circuit."""
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")


class Terminal(BaseModel):
    """Component terminal/pin."""
    id: str = Field(..., description="Terminal identifier (e.g., 'pin1', 'pin2')")
    position: Position = Field(..., description="Terminal position in image")
    connected_to: List[str] = Field(default_factory=list, description="Junction IDs connected to this terminal")


class CircuitComponent(BaseModel):
    """Detected circuit component from YOLOv7."""
    id: str = Field(..., description="Unique component identifier (e.g., 'R1', 'C2')")
    type: str = Field(..., description="Component type (e.g., 'resistor', 'capacitor', 'inductor')")
    name: str = Field(..., description="Component name (e.g., 'Resistor', 'Capacitor')")
    value: Optional[float] = Field(None, description="Component value (e.g., 100 for 100 ohms)")
    unit: Optional[str] = Field(None, description="Component unit (e.g., 'ohm', 'farad', 'henry')")
    confidence: float = Field(..., description="YOLO detection confidence (0-1)", ge=0.0, le=1.0)
    bbox: BoundingBox = Field(..., description="Bounding box in image")
    position: Position = Field(..., description="Center position in image")
    terminals: List[Terminal] = Field(default_factory=list, description="Component terminals")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Additional component properties")


class CircuitJunction(BaseModel):
    """Junction point where components connect."""
    id: str = Field(..., description="Unique junction identifier (e.g., 'J1', 'J2')")
    type: str = Field(..., description="Junction type (e.g., 'node', 'wire_intersection')")
    position: Position = Field(..., description="Junction position in image")
    bbox: Optional[BoundingBox] = Field(None, description="Junction bounding box if detected separately")
    connected_wires: List[str] = Field(default_factory=list, description="Wire IDs connected to junction")
    connected_components: List[str] = Field(default_factory=list, description="Component IDs connected to junction")
    voltage: Optional[float] = Field(None, description="Voltage at junction (from simulation)")


class CircuitWire(BaseModel):
    """Wire connecting components."""
    id: str = Field(..., description="Unique wire identifier")
    orientation: str = Field(..., description="Wire orientation (e.g., 'horizontal', 'vertical', 'diagonal')")
    start_position: Position = Field(..., description="Wire start position")
    end_position: Position = Field(..., description="Wire end position")
    connected_junctions: List[str] = Field(default_factory=list, description="Junction IDs at ends of wire")
    connected_components: List[str] = Field(default_factory=list, description="Component terminal IDs connected to wire")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Wire properties")


class CircuitData(BaseModel):
    """Complete detected circuit structure."""
    image_path: str = Field(..., description="Path to original circuit image")
    image_size: Tuple[int, int] = Field(..., description="Image dimensions (width, height)")
    detection_timestamp: datetime = Field(default_factory=datetime.utcnow, description="Detection timestamp")
    
    components: List[CircuitComponent] = Field(default_factory=list, description="Detected components")
    junctions: List[CircuitJunction] = Field(default_factory=list, description="Detected junctions")
    wires: List[CircuitWire] = Field(default_factory=list, description="Detected wires")
    
    # Analysis results
    component_count: int = Field(default=0, description="Total component count")
    junction_count: int = Field(default=0, description="Total junction count")
    wire_count: int = Field(default=0, description="Total wire count")
    
    # Metadata
    model_version: str = Field(default="yolov7", description="Detection model version")
    yolo_confidence_threshold: float = Field(default=0.5, description="YOLO confidence threshold")
    nms_iou_threshold: float = Field(default=0.45, description="NMS IOU threshold")
    
    detection_stats: Dict[str, Any] = Field(default_factory=dict, description="Detection statistics")
    
    def get_component(self, component_id: str) -> Optional[CircuitComponent]:
        """Get component by ID."""
        for comp in self.components:
            if comp.id == component_id:
                return comp
        return None
    
    def get_junction(self, junction_id: str) -> Optional[CircuitJunction]:
        """Get junction by ID."""
        for junction in self.junctions:
            if junction.id == junction_id:
                return junction
        return None
    
    def get_wire(self, wire_id: str) -> Optional[CircuitWire]:
        """Get wire by ID."""
        for wire in self.wires:
            if wire.id == wire_id:
                return wire
        return None


class CircuitAnalysis(BaseModel):
    """Circuit analysis results."""
    circuit_type: str = Field(..., description="Circuit type (e.g., 'RLC', 'RC', 'RL')")
    total_resistance: Optional[float] = Field(None, description="Total circuit resistance (ohms)")
    total_capacitance: Optional[float] = Field(None, description="Total circuit capacitance (farads)")
    total_inductance: Optional[float] = Field(None, description="Total circuit inductance (henry)")
    
    resonant_frequency: Optional[float] = Field(None, description="Resonant frequency (Hz)")
    damping_ratio: Optional[float] = Field(None, description="Damping ratio")
    natural_frequency: Optional[float] = Field(None, description="Natural frequency (Hz)")
    
    response_type: Optional[str] = Field(None, description="Response type (overdamped, underdamped, critically_damped)")
    quality_factor: Optional[float] = Field(None, description="Quality factor (Q)")
    
    properties: Dict[str, Any] = Field(default_factory=dict, description="Additional properties")


class CircuitDetectionResponse(BaseModel):
    """Response from circuit detection endpoint."""
    status: str = Field(..., description="Detection status")
    circuit_data: CircuitData = Field(..., description="Detected circuit data")
    analysis: Optional[CircuitAnalysis] = Field(None, description="Circuit analysis results")
    confidence_summary: Dict[str, float] = Field(default_factory=dict, description="Component confidence summary")
