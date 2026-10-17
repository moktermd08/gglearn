import { Banner } from "@gg/ui";

export const metadata = { title: "Not found — gglearn admin" };

export default function AdminNotFound() {
  return <Banner tone="warn" icon="alert">That admin page or record does not exist, or it belongs to a company you do not run.</Banner>;
}
