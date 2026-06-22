import React from "react";
import Navbar from "../components/layout/Navbar";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import Screenshots from "../components/landing/Screenshots";
import Testimonials from "../components/landing/Testimonials";
import Footer from "../components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Screenshots />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
