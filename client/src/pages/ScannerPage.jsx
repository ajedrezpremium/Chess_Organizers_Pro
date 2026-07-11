import { useParams } from 'react-router-dom';
import { Suspense } from 'react';
import PGNScanner from '../components/PGNScanner.jsx';

function ScannerPageContent() {
  const { id } = useParams();
  return <PGNScanner tournamentId={id} />;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-fide-900">
      <div className="animate-spin h-10 w-10 border-4 border-fide-500 border-t-transparent rounded-full" />
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ScannerPageContent />
    </Suspense>
  );
}