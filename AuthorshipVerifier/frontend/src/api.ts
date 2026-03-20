const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type DocumentDto = {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export const signupRequest = async (
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  if (!response.ok) {
    throw new Error("Signup failed");
  }

  return response.json();
};

export const loginRequest = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  return response.json();
};

export const fetchDocumentsRequest = async (token: string): Promise<DocumentDto[]> => {
  const response = await fetch(`${API_BASE_URL}/documents`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Failed to fetch documents");
  }

  const data = (await response.json()) as { documents: DocumentDto[] };
  return data.documents;
};

export const createDocumentRequest = async (
  token: string,
  title: string,
  content: string
): Promise<DocumentDto> => {
  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title, content })
  });

  if (!response.ok) {
    throw new Error("Failed to create document");
  }

  const data = (await response.json()) as { document: DocumentDto };
  return data.document;
};