import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createDocumentRequest,
  DocumentDto,
  fetchDocumentsRequest
} from "../api";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    void (async () => {
      try {
        const docs = await fetchDocumentsRequest(token);
        setDocuments(docs);
      } catch {
        setError("Failed to load documents");
      }
    })();
  }, [navigate, token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      navigate("/login");
      return;
    }

    setError("");

    try {
      const document = await createDocumentRequest(token, title, content);
      setDocuments((prev) => [document, ...prev]);
      setTitle("");
      setContent("");
    } catch {
      setError("Failed to create document");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="container">
      <div className="nav">
        <Link to="/dashboard">Dashboard</Link>
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <h1>Dashboard</h1>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleSubmit}>
        <label htmlFor="title">Document Title</label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label htmlFor="content">Document Content</label>
        <textarea
          id="content"
          rows={4}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
        />

        <button type="submit">Create Document</button>
      </form>

      <h2>Your Documents</h2>
      {documents.length === 0 ? <p>No documents yet.</p> : null}
      {documents.map((doc) => (
        <div className="card" key={doc.id}>
          <strong>{doc.title}</strong>
          <p>{doc.content}</p>
        </div>
      ))}
    </div>
  );
};

export default DashboardPage;