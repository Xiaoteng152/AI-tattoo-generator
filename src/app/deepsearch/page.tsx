import { AuthControls } from "../components/AuthControls";
import { DeepSearchView } from "./DeepSearchView";

export default function DeepSearchPage() {
  return <DeepSearchView authControls={<AuthControls callbackUrl="/deepsearch" />} />;
}
