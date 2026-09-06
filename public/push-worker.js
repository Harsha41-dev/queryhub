self.addEventListener("push", (event) => {
  const payload = event.data
    ? event.data.json()
    : {
        title: "QueryHub",
        body: "You have a new notification.",
        url: "/notifications",
      };

  event.waitUntil(
    self.registration.showNotification(payload.title || "QueryHub", {
      body: payload.body || "You have a new notification.",
      data: { url: payload.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/notifications",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => client.url === targetUrl);
        if (existing) return existing.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});
