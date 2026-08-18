'use client'

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main>
      <h1>hello there...</h1>
      <Button onClick={() => console.log('clicked')}>Click me</Button>
    </main>
  );
}
