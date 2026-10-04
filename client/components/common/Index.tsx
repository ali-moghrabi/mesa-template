import type { Section as SectionConfig } from "@/config/schema";
import { AboutSplit } from "../home/Split";
import { aboutSchema, type AboutContent } from "../home/schema";
import { AboutStacked } from "../home/Stacked";

type Props = {
  section: SectionConfig;
  content: AboutContent | undefined;
};

export function AboutSection({ section, content }: Props) {
  if (!content) return null;
  const props = aboutSchema.parse(section.props);
  const Variant = section.variant === "stacked" ? AboutStacked : AboutSplit;
  return <Variant id={section.id} props={props} content={content} />;
}
