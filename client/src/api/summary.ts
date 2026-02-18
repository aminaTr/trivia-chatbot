export async function fetchSummary({
  sessionId,
}: {
  sessionId: string | null;
}) {
  if (!sessionId) return null;
  // Fetch summary via REST API

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/api/summary/summary-results`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch summary");
    }

    return response;
  } catch (error) {
    console.error("Error fetching trivia summary:", error);
  }
}
