import asyncio
import time
from typing import Dict, Any
import anyio
from ravyn import Ravyn, Gateway, JSONResponse, post
from ravyn.utils.decorators import observable

# --- Mock ADK Agent (for demo purposes without API key) ---
class MockAgent:
    def __init__(self, name: str):
        self.name = name

    async def perform_task(self, task: str) -> Dict[str, Any]:
        print(f"[{self.name}] Analyzing task: {task}")
        await asyncio.sleep(0.1)  # Simulate LLM latency
        return {"status": "completed", "result": f"Analysis of '{task}' done"}

# --- Ravyn Application & Observables ---

# 1. Define the Action (Emitter)
@post("/agent/action")
@observable(send=["agent_action_completed"])
async def agent_action_endpoint(data: Dict[str, Any]) -> JSONResponse:
    """
    Endpoint that simulates an agent completing an action.
    Emits 'agent_action_completed' event.
    """
    # In a real app, you might parse the agent's output here
    return JSONResponse({"message": "Action received", "data": data})

# 2. Define Side Effects (Listeners)
@observable(listen=["agent_action_completed"])
async def log_activity(data: Dict[str, Any] = None):
    # Simulate logging I/O
    await asyncio.sleep(0.01)
    # print(f"[Listener: Logger] Logged action: {data.get('task_id')}")

@observable(listen=["agent_action_completed"])
async def update_stats(data: Dict[str, Any] = None):
    # Simulate DB update
    await asyncio.sleep(0.02)
    # print(f"[Listener: Stats] Updated stats for: {data.get('task_id')}")

@observable(listen=["agent_action_completed"])
async def trigger_followup(data: Dict[str, Any] = None):
    # Simulate triggering another workflow
    await asyncio.sleep(0.01)
    # print(f"[Listener: Followup] Triggered check for: {data.get('task_id')}")

# --- App Setup ---
app = Ravyn(
    routes=[
        Gateway("/agent/action", handler=agent_action_endpoint),
    ]
)

# --- Stress Test / Demo Runner ---
async def run_stress_test(requests_count: int = 100):
    print(f"\n--- Starting Stress Test: {requests_count} requests ---")
    
    # We need to run the app in a background task or just simulate the handler calls directly
    # for this script since we want to drive it from the same process.
    # However, Ravyn/Lilya handlers are just async functions. We can call them directly
    # but the @observable decorator relies on the app context or proper setup.
    # The @observable decorator in Ravyn uses an internal EventDispatcher.
    
    # To properly test this without spinning up a full uvicorn server in a separate process,
    # we will simulate the calls.
    
    start_time = time.time()
    
    async def simulate_request(i: int):
        payload = {"task_id": i, "content": "stress test"}
        # Calling the decorated handler directly
        await agent_action_endpoint(payload)

    # Use anyio to run concurrent tasks
    async with anyio.create_task_group() as tg:
        for i in range(requests_count):
            tg.start_soon(simulate_request, i)
            
    end_time = time.time()
    duration = end_time - start_time
    print(f"--- Completed {requests_count} requests in {duration:.4f}s ---")
    print(f"--- RPS: {requests_count / duration:.2f} ---")

async def main():
    print("Initializing Ravyn + ADK Demo...")
    agent = MockAgent("Gemini-Proto")
    
    # 1. Single Run
    print("\n[1] Performing Single Agent Task...")
    result = await agent.perform_task("Analyze system logs")
    # Simulate the agent calling the endpoint (or the system calling it with agent results)
    await agent_action_endpoint({"task_id": "task_001", "agent_result": result})
    
    # Allow listeners to finish (since they are fire-and-forget in background)
    await asyncio.sleep(0.5) 
    
    # 2. Stress Test
    await run_stress_test(500)
    
    # Wait a bit for all background observables to settle
    await asyncio.sleep(2.0)
    print("\nDemo Completed.")

if __name__ == "__main__":
    asyncio.run(main())
