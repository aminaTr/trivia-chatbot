export async function getCategories() {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/home/categories`,
  );
  const data = await response.json();
  return data.categories;
}
