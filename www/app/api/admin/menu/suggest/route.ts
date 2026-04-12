import { cookies } from "next/headers"
import { authedBackendFetch } from "@/lib/api-auth"

async function verifyAdmin(): Promise<boolean> {
  const res = await authedBackendFetch("/api/v1/restaurants?page_size=1")
  return res.status !== 401
}

export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return Response.json({ message: "Non authentifie" }, { status: 401 })
  }

  const cookieStore = await cookies()
  const apiKey = cookieStore.get("openai_api_key")?.value
  if (!apiKey) {
    return Response.json({ message: "Cle API OpenAI non configuree. Ajoutez-la dans Parametres." }, { status: 400 })
  }

  const { productName, cuisineContext, language } = await request.json()
  if (!productName) {
    return Response.json({ message: "product_name is required" }, { status: 400 })
  }

  const lang = language || "fr"
  const contextStr = cuisineContext ? ` dans un restaurant de type ${cuisineContext}` : ""

  const prompt = `Pour le produit "${productName}"${contextStr}, suggère des détails.
Langue: ${lang}

Retourne un JSON valide avec cette structure exacte:
{
  "description": "Description courte et appétissante",
  "suggestedPrice": 12.90,
  "allergens": ["Gluten", "Lait"],
  "suggestedOptions": [
    {
      "name": "Sauce",
      "type": "single",
      "isRequired": false,
      "choices": [
        {"name": "Ketchup", "priceModifier": 0},
        {"name": "Mayo", "priceModifier": 0.50}
      ]
    }
  ]
}

Retourne UNIQUEMENT le JSON, sans texte avant ou après.`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Tu es un expert en restauration. Tu génères des suggestions de produits au format JSON. Retourne uniquement du JSON valide." },
          { role: "user", content: prompt },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI error (${res.status}): ${err}`)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ""

    const jsonStart = text.indexOf("{")
    if (jsonStart === -1) throw new Error("No JSON in response")
    let depth = 0
    let jsonEnd = -1
    for (let i = jsonStart; i < text.length; i++) {
      if (text[i] === "{") depth++
      else if (text[i] === "}") { depth--; if (depth === 0) { jsonEnd = i; break } }
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    return Response.json(parsed)
  } catch (err) {
    return Response.json({ message: err instanceof Error ? err.message : "Erreur IA" }, { status: 500 })
  }
}
