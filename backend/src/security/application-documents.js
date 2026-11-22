import { createHash } from "node:crypto";

export const documentVersion = (doc) => Number.isInteger(doc?.versions) && doc.versions > 0 ? doc.versions : 1;
export const documentHash = (data) => createHash("sha256").update(data).digest("hex");

export function documentFileId(application, doc) {
  const legacy = `appdoc-${application.id}-${doc.key}`;
  if (!doc.file_id) return legacy;
  return doc.file_id.startsWith(legacy + "-v") ? doc.file_id : null;
}

export function documentAccepted(application, doc, getFile) {
  const id = documentFileId(application, doc);
  const file = id && getFile(id);
  return Boolean(doc.filename && file && doc.status === "diterima" &&
    doc.reviewed_version === documentVersion(doc) && doc.reviewed_sha256 === documentHash(file.data));
}
