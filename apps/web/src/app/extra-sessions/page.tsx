import { redirect } from 'next/navigation';

export default function ExtraSessionsPage() {
  redirect('/available-rooms?tab=log');
}
