import type { DeliveryAddress, UserProfile } from "@/lib/auth-types"

async function accountFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erreur inconnue" }))
    throw new Error(error.message || `Erreur ${res.status}`)
  }

  return res.json()
}

export async function updateProfile(data: { name?: string; phone?: string }): Promise<UserProfile> {
  return accountFetch<UserProfile>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return accountFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}

export async function listAddresses(): Promise<DeliveryAddress[]> {
  const data = await accountFetch<{ addresses: DeliveryAddress[] }>("/api/auth/addresses")
  return data.addresses || []
}

export async function createAddress(data: {
  label: string
  address: string
  lat?: number
  lng?: number
  isDefault?: boolean
}): Promise<DeliveryAddress> {
  return accountFetch<DeliveryAddress>("/api/auth/addresses", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteAddress(id: string): Promise<void> {
  await accountFetch(`/api/auth/addresses/${id}`, { method: "DELETE" })
}

export async function setDefaultAddress(id: string): Promise<DeliveryAddress> {
  return accountFetch<DeliveryAddress>(`/api/auth/addresses/${id}/default`, {
    method: "POST",
  })
}

export async function listOrders(page = 1, pageSize = 10) {
  return accountFetch<{ orders: Array<Record<string, unknown>>; totalCount: number }>(
    `/api/orders?page=${page}&pageSize=${pageSize}`
  )
}
