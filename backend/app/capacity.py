from dataclasses import asdict, dataclass
from typing import Mapping


ESSENTIAL_CONSTRAINTS = ("housing", "water", "sanitation", "health", "school", "road_access")


@dataclass(frozen=True)
class CapacityResult:
    effective_capacity: int
    available_capacity: int
    limiting_factor: str
    constraints: dict[str, int]
    legally_available: bool

    def to_dict(self) -> dict:
        return asdict(self)


def calculate_capacity(constraints: Mapping[str, int], current_population: int = 0, allocated_relocatees: int = 0, legally_available: bool = True) -> CapacityResult:
    missing = set(ESSENTIAL_CONSTRAINTS) - set(constraints)
    if missing:
        raise ValueError(f"Missing capacity constraints: {', '.join(sorted(missing))}")
    clean = {key: max(0, int(constraints[key])) for key in ESSENTIAL_CONSTRAINTS}
    limiting = min(clean, key=clean.get)
    effective = clean[limiting]
    available = max(0, effective - max(0, current_population) - max(0, allocated_relocatees))
    if not legally_available:
        available = 0
        limiting = "land_verification"
    return CapacityResult(effective, available, limiting, clean, legally_available)
