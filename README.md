# **Asset Editor**

A web-based visual editor for managing complex, hierarchical configuration assets. The application features a modular architecture, drag-and-drop interface, and a robust system for templating and inheritance.

Programmed with Gemini 2.5 Pro and Claude Sonnet 4 with emphasis on architectural clarity.

The project is built on a modular Core/Content architecture, which cleanly separates the generic application framework from the domain-specific business logic. The core library is the reusable engine, and the content application is a "plugin" that provides all the specific features and data models.

## **Key Features**

* **Hierarchical Asset Management**: Browse and organize assets in a familiar tree-based explorer that represents their fully qualified name (FQN) structure.

* **Templating and Inheritance**: Reduce duplication by creating base assets that other assets can inherit from. The system automatically calculates the final "merged" state by traversing the template chain.

* **Pluggable Architecture**: The application is built on a Core/Content model. The core library provides the generic framework, while the content layer implements the specific business logic, asset types, and UI components.

* **Drag-and-Drop Interface**: Intuitively manage asset hierarchy and relationships by dragging assets in the explorer or components in the canvas.

* **Undo/Redo Functionality**: All modifications are tracked as commands, allowing for reliable undo and redo of any change.

* **Real-time Validation**: The system continuously validates assets against schema and custom business rules, providing immediate feedback on potential issues.

* **Code and Tree Views** for direct JSON editing of asset properties and overrides.

* **Build & Release Hub**: A dedicated view to trigger and monitor the build process for different distros, with access to build history and logs.

---

## **Technology Stack**

The project is built with a modern frontend technology stack:

* **Framework**: Vue 3 (Composition API)

* **Language**: TypeScript

* **Build Tool**: Vite

* **State Management**: Pinia

* **UI Component Library**: Vuetify 3

* **Routing**: Vue Router

* **Code Editing**: Monaco Editor & JSONEditor

* **Testing**: Vitest with JSDOM and Vue Testing Library

---

## **Project Structure**

The codebase is organized into two primary layers to enforce a clean separation of concerns.

* `src/core/`: The generic, reusable engine of the editor. It provides the main UI shell (like AssetLibrary and InspectorPane), the state management structure (stores), and the registry patterns for extensibility. This layer has no knowledge of specific asset types.  
* `src/content/`: The specific implementation for this application. It defines the concrete asset types, their relationships, validation rules, context menus, and specialized inspector components. It acts as a plugin to the core engine.

---

## **Getting Started**

Follow these steps to get the project running on your local machine.

### **Prerequisites**

* Node.js (version 18.0.0 or higher)

### **Installation & Setup**

1. Clone the repository

2. Install dependencies:  
   This command will install all the necessary packages defined in package.json.  

   `npm install`

3. Run the development server:  
   This script starts the Vite development server.

   `npm run dev`

4. Open the application:  
   Once the server is running, you can access the Asset Editor in your browser at `http://localhost:8080`.

---

## **Available Scripts**

The following scripts are available in package.json:

* `npm run dev`: Starts the Vite development server with hot-reloading.  
* `npm run build`: Compiles and bundles the application for production into the dist/ directory.  
* `npm run preview`: Starts a local server to preview the production build from the dist/ directory.  
* `npm run lint`: Lints all source files using ESLint and attempts to automatically fix issues.  
* `npm run test`: Runs the automated test suite using Vitest.  
* `npm run test:ui`: Runs the automated test suite with the Vitest UI for an interactive experience.  
* `npm run type-check`: Runs the TypeScript compiler to check for type errors without emitting JavaScript files.


## Concepts

---

### **Namespace-Driven Asset Management**

The entire project is built on a **Namespace-Driven Asset Management** system. Instead of relying on traditional folder structures or database relations to define hierarchy, the system uses a string-based identifier called a **Fully Qualified Name (FQN)** as the single source of truth for every asset's identity and location.

* **What is an FQN?**: An FQN is a unique, human-readable path for an asset, constructed by joining the names of its parent assets with a :: delimiter. For example, the FQN DataCenter-minimal::WebServer::Nginx clearly signifies an "Nginx" asset belonging to a "WebServer" asset, which itself is part of the "DataCenter-minimal" distro. Assets at the top level, which are considered globally shared, have an FQN equal to their own name (e.g., BasePackage).  
* **Virtual Hierarchy**: This system creates a virtual folder structure from a flat list of assets. The application's UI, particularly the Asset Explorer tree, is not built from explicit folder objects but is dynamically generated by parsing these FQNs. The system understands that WebServer::Nginx is a child of WebServer simply by interpreting the string, even if no explicit "WebServer" folder object exists. This makes the structure incredibly flexible and data-driven.  
* **Defining Relationships**: The FQN is fundamental to defining both parent-child relationships and template inheritance, which are the two most critical relationships in the system.

---

### **Asset Templating and Inheritance System**

To promote reusability and reduce configuration duplication, the editor features a powerful templating and inheritance system. This allows you to create base assets that other, more specific assets can inherit from.

* **The Mechanism**: The link between an asset and its template is established via the templateFqn property. An asset can point to any other asset of the same type by storing the target asset's FQN in this property.  
* **The Merging Process**: When you view or build an asset, the system calculates its final "merged" state by walking up the inheritance chain. This process works as follows:  
  1. It starts with the selected asset and checks its templateFqn.  
  2. It finds the template asset and then checks *its* templateFqn, continuing this process until it reaches a root asset with no template. This creates an inheritance chain (e.g., Nginx \-\> BaseWebServer \-\> Shared-WebServer-Template).  
  3. The system then applies the configuration "overrides" from each asset in the chain, starting with the top-most ancestor. Each level's properties are merged on top of the previous one, with properties from assets lower in the chain overwriting those from assets higher up.  
  4. Finally, the selected asset's own overrides are applied last, giving it the final say. This entire calculation is performed by the calculateMergedAsset utility, which relies exclusively on FQNs to resolve the inheritance path.

This system means a change to a single base template can instantly propagate to dozens of inheriting assets, making maintenance far more efficient.

---

### **Asset Operations (The Command Pattern)**

To ensure that every action taken by the user is robust, reliable, and reversible, all modifications are handled through a **Command Pattern**.

* **How It Works**: Instead of modifying state directly, every user action (creating, updating, deleting, moving, or renaming an asset) is encapsulated in a Command object. This object contains all the information needed to both perform and reverse the action.  
  * When a user performs an action, the workspaceStore creates a new command (e.g., new UpdateAssetCommand(...)).  
  * It then calls the command's execute() method, which applies the change to the pendingChanges in the workspace.  
  * The command object is then pushed onto an undoStack.  
* **Undo/Redo**: This architecture makes undo/redo trivial and reliable. "Undo" simply pops the last command from the undoStack, calls its unexecute() method (which contains the logic to reverse the change), and pushes the command onto a redoStack. "Redo" does the opposite.  
* **Complex Operations**: More complex operations like moving or renaming an asset are handled by a single, powerful ApplyRefactoringCommand. This command first calculates all the "ripple effects" of the change (like updating the FQNs of all descendant assets) and bundles them into one atomic transaction that can be undone or redone with a single click.

---

### **Focus on Safety and User Confidence**

The editor is designed to give users maximum confidence and prevent accidental, destructive changes. This is achieved through a workflow that prioritizes visibility and confirmation.

* **Staged Changes**: No change is saved automatically. All modifications are first staged as pendingChanges. The user must explicitly click "Commit Changes" and write a commit message to save their work, similar to a Git workflow.  
* **Commit Dialog with Diffing**: The cornerstone of this safety net is the commit dialog. Before saving, the user is presented with a clear, categorized summary of all changes:  
  * **Modified**: For every asset that was changed, the dialog shows a "diff"�a precise, line-by-line comparison of the asset's state *before* and *after* the changes. This allows the user to see exactly which properties were added, removed, or modified.  
  * **Added**: A simple list of all new assets being created.  
  * **Deleted**: A list of all assets being removed.  
* **Ripple Effect Visibility**: The system's most powerful safety feature is its ability to preview the cascading impact of changes. If a user modifies an asset that is used as a template by other assets, the commit dialog will display a **"Ripple Effect"** section. This section shows all the *other* assets that will be indirectly affected by the change and displays a diff of how their final merged properties will be altered. This prevents a user from making a seemingly small change that accidentally breaks dozens of other configurations.  
* **Refactor Confirmation**: Similarly, before a complex "Move" or "Rename" operation is executed, a confirmation dialog appears. This dialog explicitly lists all the cascading FQN updates and template link updates that will occur. The user must review and approve these consequences *before* the operation is performed, preventing accidental, widespread refactoring.
