export async function GET() {
  return new Response(JSON.stringify({ 
    status: "ok", 
    message: "Chat stream API is accessible",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}