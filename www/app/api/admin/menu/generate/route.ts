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

  const { cuisineType, language } = await request.json()
  if (!cuisineType) {
    return Response.json({ message: "cuisine_type is required" }, { status: 400 })
  }

  const lang = language || "fr"

  const prompt = `Génère un menu complet pour un restaurant de type "${cuisineType}".
Langue: ${lang}

Retourne un JSON valide avec cette structure exacte:
{
  "categories": [
    {
      "name": "Nom de la catégorie",
      "products": [
        {
          "name": "Nom du produit",
          "description": "Description courte et appétissante",
          "price": 12.90,
          "allergens": ["Gluten", "Lait"],
          "options": [
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
      ]
    }
  ]
}

Génère 3-5 catégories avec 3-5 produits chacune. Les prix doivent être réalistes en euros. Inclus des options/suppléments pertinents. Retourne UNIQUEMENT le JSON, sans texte avant ou après.`

  try {
    const result = await callOpenAI(apiKey, prompt)
    const parsed = JSON.parse(result)
    return Response.json(parsed)
  } catch (err) {
    return Response.json({ message: err instanceof Error ? err.message : "Erreur IA" }, { status: 500 })
  }
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert en restauration. Tu génères des menus au format JSON. Retourne uniquement du JSON valide." },
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

  // Extract JSON from potential markdown code blocks
  const jsonStart = text.indexOf("{")
  if (jsonStart === -1) throw new Error("No JSON in response")
  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") { depth--; if (depth === 0) { jsonEnd = i; break } }
  }
  return text.slice(jsonStart, jsonEnd + 1)
}
