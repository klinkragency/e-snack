import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const apiKey = cookieStore.get("openai_api_key")?.value

  if (!apiKey) {
    return NextResponse.json(
      { message: "Clé API OpenAI non configurée. Allez dans Paramètres pour la définir." },
      { status: 400 }
    )
  }

  const { jsonInput, restaurantId } = await request.json()

  if (!jsonInput) {
    return NextResponse.json({ message: "JSON requis" }, { status: 400 })
  }

  const systemPrompt = `Tu es un assistant spécialisé dans la création de menus de restaurant.
Tu reçois un JSON brut contenant des données de menu (possiblement mal structuré, en plusieurs formats possibles).
Tu dois analyser ce JSON et le convertir en un format standardisé.

IMPORTANT:
- Analyse le JSON fourni et identifie les catégories et produits
- Si le JSON est déjà structuré avec des catégories, garde cette structure
- Si c'est juste une liste de produits, regroupe-les par type/catégorie logique
- Pour chaque produit, assure-toi d'avoir: name, description, price, allergens
- Si des informations manquent (description, allergens), génère-les de façon réaliste
- Les prix doivent être des nombres (pas de symbole €)
- Les allergens doivent être un tableau de strings

Réponds UNIQUEMENT avec un JSON valide au format suivant:
{
  "categories": [
    {
      "name": "Nom de la catégorie",
      "products": [
        {
          "name": "Nom du produit",
          "description": "Description appétissante",
          "price": 12.50,
          "allergens": ["gluten", "lactose"]
        }
      ]
    }
  ]
}`

  const userPrompt = `Voici le JSON du menu à importer:\n\n${jsonInput}\n\nConvertis-le au format standardisé.`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return NextResponse.json(
        { message: err.error?.message || "Erreur OpenAI" },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ message: "Réponse vide de l'IA" }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error("Import menu error:", err)
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Erreur lors de l'import" },
      { status: 500 }
    )
  }
}
