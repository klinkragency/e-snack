"use client";

import Image from "next/image";
import { Smartphone } from "lucide-react";

export function AppSection() {
  return (
    <section id="app" className="bg-background overflow-hidden">
      {/* Main Content */}
      <div className="px-6 pt-16 pb-12 md:px-12 md:py-24 lg:px-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left Content */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Smartphone size={14} />
              Application mobile
            </div>

            {/* Title */}
            <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
              Télécharge l'app
              <br />
              et commande partout
            </h2>

            {/* Description */}
            <p className="mt-6 max-w-md text-muted-foreground">
              Retrouve tous tes restaurants e-Snack dans ta poche. Commande plus vite, profite d'offres exclusives et suis tes livraisons en temps réel.
            </p>

            {/* Features */}
            <div className="mt-8 flex flex-wrap gap-4">
              <span className="rounded-full border border-border px-4 py-2 text-sm text-foreground">
                Commande rapide
              </span>
              <span className="rounded-full border border-border px-4 py-2 text-sm text-foreground">
                Notifications live
              </span>
              <span className="rounded-full border border-border px-4 py-2 text-sm text-foreground">
                Offres exclusives
              </span>
            </div>

            {/* Store Buttons */}
            <div className="mt-10 flex flex-wrap gap-4">
              {/* App Store Button */}
              <a
                href="#"
                className="inline-flex items-center gap-3 rounded-full bg-foreground px-5 py-3 transition-opacity hover:opacity-80"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-background">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-background/70">Télécharger sur</p>
                  <p className="text-sm font-medium text-background">App Store</p>
                </div>
              </a>

              {/* Google Play Button */}
              <a
                href="#"
                className="inline-flex items-center gap-3 rounded-full bg-foreground px-5 py-3 transition-opacity hover:opacity-80"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-background">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-background/70">Disponible sur</p>
                  <p className="text-sm font-medium text-background">Google Play</p>
                </div>
              </a>
            </div>
          </div>

          {/* Right Content - Phone Mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative h-[600px] w-[300px] md:h-[700px] md:w-[350px]">
              {/* Phone Frame */}
              <div className="absolute inset-0 rounded-[3rem] border-8 border-foreground bg-background shadow-2xl overflow-hidden">
                {/* Dynamic Island / Notch */}
                <div className="absolute left-1/2 top-4 z-20 h-7 w-28 -translate-x-1/2 rounded-full bg-black"></div>
                
                {/* Screen Content */}
                <div className="h-full w-full bg-neutral-50 flex flex-col pt-12 relative overflow-hidden">
                  
                  {/* Status Bar Mock */}
                  <div className="absolute top-0 w-full px-6 py-4 flex justify-between text-xs font-medium z-10">
                    <span>9:41</span>
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-neutral-800"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-neutral-800"></div>
                      <div className="h-2.5 w-4 rounded-full bg-neutral-800"></div>
                    </div>
                  </div>

                  {/* App Header */}
                  <div className="px-5 pb-4 flex justify-between items-center z-10 bg-neutral-50/80 backdrop-blur-md sticky top-0">
                    <div className="flex flex-col">
                      <span className="text-xs text-neutral-400 font-medium">LIVRER À</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-neutral-800">Monaco, MC</span>
                        <svg className="w-3 h-3 text-neutral-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center">
                       <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                  </div>

                  {/* App Body - Scrollable */}
                  <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-20 space-y-4">
                    
                    {/* Categories */}
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                      {["Tout", "Burgers", "Pizza", "Healthy", "Sushi"].map((cat, i) => (
                        <div key={i} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${i === 0 ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-600'}`}>
                          {cat}
                        </div>
                      ))}
                    </div>

                    {/* Featured Item */}
                    <div className="w-full aspect-[4/3] rounded-2xl bg-white overflow-hidden shadow-sm relative group">
                       <Image
                        src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800"
                        alt="Burger"
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                       />
                       <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold">
                         20-30 min
                       </div>
                       <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                         <div className="font-bold text-sm">Le Smash Burger</div>
                         <div className="text-[10px] opacity-80">Américain • 4.9 (120+)</div>
                       </div>
                    </div>

                    {/* List Items */}
                    {[
                      { name: "Tacos Factory", img: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=800", type: "Mexicain" },
                      { name: "Green Bowl", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800", type: "Healthy" },
                      { name: "Napoli Pizza", img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=800", type: "Italien" }
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3 bg-white p-2.5 rounded-xl shadow-sm border border-neutral-100">
                        <div className="h-16 w-16 rounded-lg overflow-hidden relative shrink-0">
                           <Image src={item.img} alt={item.name} fill className="object-cover" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <div className="font-bold text-sm text-neutral-900">{item.name}</div>
                          <div className="text-xs text-neutral-500">{item.type} • $$</div>
                          <div className="text-[10px] text-green-600 font-medium mt-0.5">Livraison offerte</div>
                        </div>
                      </div>
                    ))}

                  </div>

                  {/* Bottom Navigation */}
                  <div className="absolute bottom-0 w-full bg-white border-t border-neutral-100 h-16 flex justify-around items-center px-2 pb-4 pt-2 z-20">
                    <div className="flex flex-col items-center gap-1">
                      <div className="bg-neutral-900 text-white p-1.5 rounded-full">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-40">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                     <div className="flex flex-col items-center gap-1 opacity-40">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                     <div className="flex flex-col items-center gap-1 opacity-40">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                  </div>

                  {/* Home Indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full z-30"></div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
