import logging
import asyncio
import sys
import os
from typing import AsyncGenerator
from typing_extensions import override

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

# Handle import of sibling module 'ravyn_integration'
from .ravyn_integration import ravyn_manager

logger = logging.getLogger(__name__)

# --- Constants ---
APP_NAME = "ping_pong_demo"
USER_ID = "user-1"
SESSION_ID = "session-1"

class PingPongAgent(BaseAgent):
    """
    A custom ADK Agent that streams 'pings' as Events.
    It checks for interruption signals from the encapsulated RavynManager.
    """
    
    # model_config allows setting Pydantic configurations if needed
    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, name: str = "PingPongAgent"):
        super().__init__(name=name)

    @override
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        """
        The core execution loop of the agent.
        Yields Event objects to the Runner.
        """
        logger.info(f"[{self.name}] Starting ping stream...")
        
        # We'll stream 10 pings unless interrupted
        for i in range(10):
            # 1. Check for interruption signal via RavynManager
            if ravyn_manager.check_interruption():
                logger.warning(f"[{self.name}] 🛑 Stream interrupted by external event!")
                
                yield Event(
                    author=self.name,
                    content=types.Content(
                        parts=[types.Part(text=f"Ping {i} (INTERRUPTED)")]
                    )
                )
                return

            msg = f"Ping {i}"
            logger.info(f"[{self.name}] 📤 Yielding Event: {msg}")

            # 2. Yield the event to the ADK Runner
            yield Event(
                author=self.name,
                content=types.Content(
                    parts=[types.Part(text=msg)]
                )
            )

            # 3. Trigger Ravyn event via RavynManager
            await ravyn_manager.emit_ping(msg, i)

            # Simulate work/latency
            await asyncio.sleep(0.5)
        
        logger.info(f"[{self.name}] Stream completed normally.")

# Expose the agent instance as root_agent for ADK
root_agent = PingPongAgent()

# --- Setup Runner and Session (Helper for local run) ---
async def setup_session_and_runner():
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name=APP_NAME, 
        user_id=USER_ID, 
        session_id=SESSION_ID
    )
    logger.info(f"Initial session state: {session.state}")
    
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service
    )
    return session_service, runner

# --- Function to Interact with the Agent ---
async def call_agent_async():
    """
    Runs the agent workflow.
    """
    print("--- Starting Ping/Pong Real ADK Runtime Demo ---")
    
    session_service, runner = await setup_session_and_runner()

    # Create initial message
    content = types.Content(
        role='user', 
        parts=[types.Part(text="Start pings")]
    )
    
    # Run the agent
    events = runner.run_async(
        user_id=USER_ID, 
        session_id=SESSION_ID, 
        new_message=content
    )

    print("\n--- Stream Output ---")
    async for event in events:
        if event.content and event.content.parts:
            print(f"[{event.author}]: {event.content.parts[0].text}")

    print("\n--- Demo Completed ---")
    
    # Verify Results
    if ravyn_manager.check_interruption():
        print("✅ SUCCESS: Stream was successfully interrupted.")
    else:
        print("❌ FAILURE: Stream was not interrupted.")

if __name__ == "__main__":
    # Configure logging if running as main
    logging.basicConfig(level=logging.INFO)
    asyncio.run(call_agent_async())
