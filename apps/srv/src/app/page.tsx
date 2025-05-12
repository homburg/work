import { sys } from "@/sys";

export default async function Home() {
  const result = await sys();
  return <pre className="p-16 whitespace-pre-wrap">{result}</pre>;
}
