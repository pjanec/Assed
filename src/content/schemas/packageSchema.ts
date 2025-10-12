import { ref, type Ref } from 'vue';
// NOTE: We are using an older version of ajv (v6) via the `jsoneditor` dependency.
// The @types/ajv package for this version does not export a named 'SchemaObject'.
// Instead, we use a generic object type which is compatible and correct for JSON schemas.
type JsonSchema = Record<string, any>;

// Reactive reference to hold all schemas
interface Schemas {
  package: JsonSchema;
  fetchers: Record<string, JsonSchema>;
}

export const schemas: Ref<Schemas | null> = ref(null);

// --- Fetcher Parameter Schemas ---
// Derived from fetcher-def.txt

const GitFolder = {
  title: "Git Folder Parameters",
  type: "object",
  properties: {
    repo: { type: "string", description: "Name of the repository (e.g., 'MyGitRepo')" },
    branch: { type: "string", description: "Branch to find the latest commit if 'commit' is empty." },
    folder: { type: "string", description: "Folder path to fetch, relative to repo root." },
    commit: { type: "string", description: "Specific commit hash to fetch from. If empty, uses HEAD of the branch." },
    build: { type: "integer", default: 0, description: "If positive, uses this build's commit instead of the 'commit' field." }
  },
  required: ["repo", "folder"]
};

// --- Main Package Configuration Schema ---

const packageSchema = {
  title: "Package Configuration",
  type: "object",
  properties: {
    Files: {
      type: "object",
      description: "A dictionary of files, keyed by file path.",
      additionalProperties: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content of the file." }
        },
        required: ["content"]
      }
    },
  },
  additionalProperties: false // Disallow properties not in the schema
};

// Function to initialize and export all schemas
export function initializeSchemas() {
  schemas.value = {
    package: packageSchema,
    fetchers: {
      GitFolder: GitFolder,
    }
  };
}

// Function to get a specific fetcher schema
export function getFetcherSchema(fetcherName: string): JsonSchema | null {
  return schemas.value?.fetchers?.[fetcherName] || null;
}

















