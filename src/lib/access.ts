export function hasPortalAccess(roles: readonly string[] | undefined) {
  return roles?.some((role) => role === "user" || role === "admin") ?? false;
}

export function getDeviceId() {
  let id = localStorage.getItem("rdx_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("rdx_device_id", id);
  }
  return id;
}