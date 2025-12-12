import logging
from typing import Dict, Any, Optional
from ravyn import Ravyn
from ravyn.utils.decorators import observable

logger = logging.getLogger(__name__)

class RavynManager:
    """
    Encapsulates Ravyn Observables and state management.
    """
    def __init__(self):
        self.should_stop = False
        # Initialize Ravyn app (needed to register decorators)
        self.app = Ravyn(routes=[])

    def check_interruption(self) -> bool:
        return self.should_stop

    async def emit_ping(self, msg: str, count: int):
        """
        Emits the 'ping_emitted' event to Ravyn listeners.
        """
        await ping_emitted_handler({"msg": msg, "count": count})

# Global instance to be shared
ravyn_manager = RavynManager()

# --- Ravyn Observables ---

# 1. Event Emitter: Ping Emitted
@observable(send=["ping_emitted"])
async def ping_emitted_handler(data: Dict[str, Any]):
    """
    Virtual handler that emits the 'ping_emitted' event.
    """
    pass

# 2. Listener: Pong Agent
@observable(listen=["ping_emitted"])
async def pong_listener(data: Dict[str, Any]):
    """
    Pong Agent listens to pings and decides when to interrupt.
    """
    count = data.get("count")
    msg = data.get("msg")
    logger.info(f"[Pong Agent (Ravyn)] 📥 Received: {msg}")
    
    # Logic to trigger interruption after 3 pings
    if count == 3:
        logger.info("[Pong Agent (Ravyn)] 😤 Decided to interrupt! Sending stop signal...")
        await trigger_interruption({"reason": "Enough pings, let's talk about something else."})

# 3. Event Emitter: Interruption Trigger
@observable(send=["interrupt_ping"])
async def trigger_interruption(data: Dict[str, Any]):
    """
    Virtual handler that emits the 'interrupt_ping' event.
    """
    pass

# 4. Listener: System Interruption Handler
@observable(listen=["interrupt_ping"])
async def handle_interruption(data: Dict[str, Any]):
    """
    System handler that processes the interruption request.
    Updates the shared state in RavynManager.
    """
    reason = data.get("reason")
    logger.warning(f"[System (Ravyn)] ⚠️ Handling interruption request: '{reason}'")
    ravyn_manager.should_stop = True
