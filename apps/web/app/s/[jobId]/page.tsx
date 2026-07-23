import OnboardingWizard from "@/components/OnboardingWizard";

export default function ResumePage({
  params,
}: {
  params: { jobId: string };
}) {
  return <OnboardingWizard resumeJobId={params.jobId} />;
}
