"use client";

import { auth } from "@/lib/firebase-client";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("testuser@example.com");
  const [password, setPassword] = useState("password123");

  const sendTokenToBackend = async (idToken: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (res.ok) {
      await auth.signOut(); // Wipe client-side session state
      router.push("/dashboard"); // Redirect to protected page
      router.refresh();
    } else {
      alert("Backend rejected the token!");
    }
  };

  const handleSignUp = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCred.user.getIdToken();
      await sendTokenToBackend(idToken);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSignIn = async () => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCred.user.getIdToken();
      await sendTokenToBackend(idToken);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Test Firebase Auth Flow</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} /><br/><br/>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} /><br/><br/>
      <button onClick={handleSignUp}>1. Create Account & Test Login</button>
      <button onClick={handleSignIn} style={{ marginLeft: "10px" }}>2. Sign In Existing</button>
    </div>
  );
}
