window.AvaOpsHooks = window.AvaOpsHooks || {};
window.AvaOpsHooks.OpsEventStream = {
  mounted() {
    this.handleEvent("ava_event", (payload) => {
      const root = document.getElementById("ops-live");
      if (!root) return;
      root.dataset.lastEventType = payload.event_type || payload?.event_type || "unknown";
    });
  },
};
