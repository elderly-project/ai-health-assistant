export default function PatientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 w-full flex flex-col gap-4 p-4 md:gap-8 md:p-6">
      {children}
    </div>
  );
} 