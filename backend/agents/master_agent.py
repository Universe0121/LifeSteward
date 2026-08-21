"""Master Agent entry point for Day1."""

from .state import AgentState


class MasterAgent:
    """Coordinate specialized agents.

    Day1 keeps this class as a stateless placeholder. Future workflow
    dispatching will be added here without changing the service boundary.
    """

    def process(self, state: AgentState) -> AgentState:
        """Return the state unchanged until agent routing is implemented."""

        return state

