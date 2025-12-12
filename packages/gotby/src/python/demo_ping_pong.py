import asyncio
import logging
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

import sys
import os
# Add 'src' to sys.path to allow importing 'agents'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.ping_pong_agent.agent import root_agent
from agents.ping_pong_agent.ravyn_integration import ravyn_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    print("--- Starting Ping/Pong Real ADK Runtime Demo (Structured) ---")
    print("Goal: PingPongAgent yields Events. Pong Listener interrupts via Ravyn.\n")
    
    # 1. Initialize ADK Components
    session_service = InMemorySessionService()
    
    # Use 'ping_pong_agent' to match the directory name and avoid ADK warnings
    APP_NAME = "ping_pong_agent"
    
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service
    )

    # Create the session first
    await session_service.create_session(
        app_name=APP_NAME,
        user_id="user-1",
        session_id="session-1"
    )

    # 2. Run the Agent
    run_gen = runner.run_async(
        user_id="user-1",
        session_id="session-1",
        new_message=types.Content(parts=[types.Part(text="Start pings")])
    )
    
    # Iterate over the generator to execute the agent
    print("\n--- Stream Output ---")
    async for event in run_gen:
        if event.content and event.content.parts:
            print(f"[{event.author}]: {event.content.parts[0].text}")
    
    print("\n--- Demo Completed ---")
    
    # 3. Verify Results
    if ravyn_manager.check_interruption():
        print("✅ SUCCESS: Stream was successfully interrupted.")
    else:
        print("❌ FAILURE: Stream was not interrupted.")

if __name__ == "__main__":
    asyncio.run(main())
