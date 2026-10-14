import { UnderConstruction } from "@/components/common/UnderConstruction";

export default function ContentPage() {
  return (
    <UnderConstruction
      variant="admin"
      title="Content"
      description="This section is currently under construction. It will be available in the next update."
      backHref="/admin"
      backLabel="Back to overview"
    />
  );
}
