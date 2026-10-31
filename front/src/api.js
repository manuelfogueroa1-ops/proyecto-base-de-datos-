export async function request(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    headers: body ? {'Content-Type': 'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No fue posible completar la operación.');
  return payload;
}
