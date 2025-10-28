# Inheritance and templating guide

# **Property Inheritance**

**Objective:** This document provides a detailed explanation of the **Property Inheritance** model. It explains what it is, how it works, and how it complements Structural Inheritance to create fully configured assets.

### **1\. What is Property Inheritance?**

Property Inheritance is a mechanism that allows a single, specific asset (like a Node or a Package) to inherit its internal configuration values from a designated template.

It answers the question: **"What are the final properties and configuration values for *this individual asset*?"**

Instead of inheriting a layout of child assets, this model focuses on the asset's own overrides object. It allows you to define a "base configuration" in one template and reuse it across many different assets, each of which can then add or change specific values.

* **How it's controlled:** By the **asset's own templateFqn property**.  
* **Primary Function:** To reduce duplication of common configuration values (like port numbers, memory settings, or file paths) and establish a "default" set of properties for a certain class of asset.

### **2\. How It Works: The Merging Engine**

The engine behind Property Inheritance is the **Merging Engine** (the calculateMergedAsset function). When you need the final configuration for a single asset, this engine performs a hierarchical deep merge.

The engine follows a clear "bottom-up, top-down" process:

1. **Find the Inheritance Chain:** It starts with the asset in question (e.g., MyWebServer) and walks *up* its templateFqn chain, collecting every template it finds until it reaches a template with no parent. This creates an ordered list of all ancestors.  
2. **Deep Merge Properties:** The engine then processes this list from the top-most ancestor down to the final asset. It performs a **deep merge** of the overrides object at each step. Properties from assets lower in the chain will overwrite properties from assets higher up the chain.  
3. **Local Overrides Win:** The final step is always to merge the overrides from the asset you originally requested. This ensures that the most specific configuration always has the final say.

The result is a single, consolidated properties object representing the final, effective configuration of that one asset.

### **3\. Core Scenarios Explained**

Let's explore how this works with diagrams.

#### **Scenario 1: Basic Property Inheritance**

A WebServer node gets its entire configuration from a TemplateNode.

**Setup:**

* A template TemplateNode has default properties for CPU and Memory.  
* A new WebServer node sets its templateFqn to 'TemplateNode' and has no local overrides of its own.

\+-----------------+  
|   TemplateNode  |  
|-----------------|  
| overrides:      |  
|  {              |  
|    "cpu": "2c", |  
|    "mem": "8G"  |  
|  }              |  
\+-----------------+  
       ^  
       | (Inherits Properties)  
       |  
\+-----------------+  
|    WebServer    | (Node)  
| (templateFqn:   |  
|  'TemplateNode')|  
|-----------------|  
| overrides: {}   |  
\+-----------------+

**Merging Engine's Logic:**

1. **Find Chain:** The engine starts at WebServer and finds its template, TemplateNode. The chain is \[TemplateNode, WebServer\].  
2. **Merge Properties:** It starts with the properties from TemplateNode. Then it merges the empty overrides from WebServer on top, which changes nothing.

**Result:** The final merged properties for WebServer will be { "cpu": "2c", "mem": "8G" }.

#### **Scenario 2: Inheritance with Local Overrides**

A WebServer inherits from TemplateNode but specifies a different amount of memory and adds a new property for storage.

**Setup:**

* TemplateNode has defaults for CPU and Memory.  
* WebServer sets its templateFqn to 'TemplateNode' and has its own overrides with mem and disk.

\+-----------------+  
|   TemplateNode  |  
|-----------------|  
| overrides:      |  
|  {              |  
|    "cpu": "2c", |  
|    "mem": "8G"  |  \<-- This will be overridden  
|  }              |  
\+-----------------+  
       ^  
       | (Inherits Properties)  
       |  
\+-----------------+  
|    WebServer    | (Node)  
| (templateFqn:   |  
|  'TemplateNode')|  
|-----------------|  
| overrides:      |  
|  {              |  
|    "mem": "16G", |  \<-- Local value wins  
|    "disk": "1T"  |  \<-- New value is added  
|  }              |  
\+-----------------+

**Merging Engine's Logic:**

1. **Find Chain:** The chain is \[TemplateNode, WebServer\].  
2. **Merge Properties:**  
   * Starts with TemplateNode's properties: { "cpu": "2c", "mem": "8G" }.  
   * Deep merges WebServer's properties on top. The mem property is overwritten, and the disk property is added.

**Result:** The final merged properties for WebServer will be { "cpu": "2c", "mem": "16G", "disk": "1T" }.

#### **Scenario 3: Multi-Level (Chained) Inheritance**

An NginxPackage inherits from a LinuxService template, which in turn inherits from a BasePackage template.

**Setup:**

* BasePackage provides a default license.  
* LinuxService inherits from BasePackage and adds a user, but overrides the license.  
* NginxPackage inherits from LinuxService and adds a port.

\+------------------+  
|   BasePackage    |  
|------------------|  
| overrides:       |  
| { "license": "GPL" } |  
\+------------------+  
        ^  
        | (Inherits from BasePackage)  
\+------------------+  
|   LinuxService   |  
|------------------|  
| overrides:       |  
| {                |  
|  "license": "MIT",|  
|  "user": "root"  |  
| }                |  
\+------------------+  
        ^  
        | (Inherits from LinuxService)  
\+------------------+  
|   NginxPackage   |  
|------------------|  
| overrides:       |  
| { "port": 80 }   |  
\+------------------+

# 

# **Structural Inheritance**

**Objective:** This document provides a detailed explanation of the **Structural Inheritance** model, a core feature of the asset management system. It explains what it is, how it works, and why it is a powerful tool for creating scalable and maintainable configurations.

### **1\. What is Structural Inheritance?**

Structural Inheritance is a mechanism that allows a parent asset (like an Distro) to inherit an entire **collection of child assets** from a designated template.

It answers the question: **"What is the default layout or composition of this asset?"**

Instead of inheriting simple property values (like colors or numbers), the asset inherits its fundamental structure—the nodes, packages, and other components that make it up. This allows you to define a reusable "blueprint" or "starter kit" in one place and apply it to many different instances.

* **How it's controlled:** By the **parent asset's templateFqn property**.  
* **Primary Function:** To promote reusability and enforce consistency by defining common asset layouts in a single, authoritative template.

### **2\. How It Works: The Resolution Engine**

The magic behind Structural Inheritance is the **Resolution Engine** (the resolveInheritedCollection function). When you ask for the final list of children for a specific asset (e.g., all Node assets within ProductionDistro), the engine performs a hierarchical merge.

The engine follows three simple but powerful rules, in order:

1. **Local Assets are Highest Priority:** Any explicit child asset you create directly under a parent always takes precedence.  
2. **Suppressors are Commands:** A special InheritanceSuppressor asset is a direct command to *block* an inherited asset with the same name (assetKey).  
3. **Inherited Assets Fill the Gaps:** The engine walks up the parent's template chain and adds any child assets it finds, but *only if* an asset with the same name has not already been handled by a local override or a suppressor.

The result is a predictable, final collection of child assets, which is then displayed in the read-only "Merged View" folder in the UI.

### **3\. Core Scenarios Explained**

Let's explore the three main scenarios using diagrams.

#### **Scenario 1: Basic Inheritance**

An empty distro (StagingDistro) inherits the complete structure from a template (BaseDistro).

**Setup:**

* A template BaseDistro contains two children: WebServer (Node) and Database (Node).  
* A new, empty StagingDistro sets its templateFqn to 'BaseDistro'.

    (Template)  
\+------------------+  
|     BaseDistro      |  
\+--------+---------+  
         |  
         |-- (has child) \--\> \+-------------+  
         |                   |  WebServer  | (Node)  
         |                   \+-------------+  
         |  
         \`-- (has child) \--\> \+-------------+  
                             |   Database  | (Node)  
                             \+-------------+

     (Instance)  
\+------------------+  
|    StagingDistro    |  
| (templateFqn:    |  \<-- Inherits Structure  
|    'BaseDistro')    |  
\+------------------+

**Resolution Engine's Logic:**

1. **Local Assets:** The engine looks for nodes under StagingDistro. It finds none.  
2. **Inherited Assets:** It moves to the template BaseDistro. It finds WebServer and Database. Since no local assets are blocking them, it adds both to the final collection.

**Result:** The "Merged View" for StagingDistro will contain both WebServer and Database.

#### **Scenario 2: Explicit Override**

A ProductionDistro inherits from BaseDistro but provides its own, more powerful version of the Database.

**Setup:**

* BaseDistro contains WebServer and a standard Database (Node).  
* ProductionDistro sets its templateFqn to 'BaseDistro'.  
* Crucially, a **real Node asset** is created with the FQN ProductionDistro::Database. This is the override.

##### **The Shadowing Mechanism: assetKey is the Key**

The override works because the Resolution Engine prioritizes local assets. It uses the **assetKey** to identify which inherited assets have been "shadowed" or replaced.

Resolution for 'ProductionDistro':

1\. Find local children:  
   \- Found one: \`ProductionDistro::Database\`  
   \- Its \`assetKey\` is "Database".

2\. Add to final collection map:  
   \- collection\['Database'\] \= \`ProductionDistro::Database\`

3\. Look at template \`BaseDistro\`:  
   \- Find inherited child: \`BaseDistro::Database\`  
   \- Its \`assetKey\` is "Database".

4\. Check collection map:  
   \- Is the key 'Database' already present? YES.  
   \- Action: \*\*DISCARD\*\* the inherited asset.

\+----------------------------+      \+----------------------------+  
| Inherited Asset            |      | Local Override             |  
|----------------------------|      |----------------------------|  
| assetKey: "Database"       |      | assetKey: "Database"       |  
| from: \`BaseDistro\`            |      | from: \`ProductionDistro\`      |  
\+----------------------------+      \+----------------------------+  
               |                               |  
               \`-----------\> BLOCKED \<---------\`  
                             (assetKey matches)

**Resolution Engine's Logic (in practice):**

1. **Local Assets:** The engine scans ProductionDistro first. It finds the local ProductionDistro::Database. It adds this asset to the final collection under the key Database. **This slot is now filled.**  
2. **Inherited Assets:** It moves to the template BaseDistro and finds the inherited WebServer and Database.  
   * It checks WebServer: the 'WebServer' slot is empty. It **adds** the inherited WebServer.  
   * It checks Database: the 'Database' slot is **already taken**. It **discards** the inherited Database.

**Result:** The "Merged View" for ProductionDistro will contain the **inherited WebServer** and the **local, overriding Database**.

#### **Scenario 3: Explicit Suppression**

A DevDistro inherits from BaseDistro but needs to completely remove the Database.

**Setup:**

* BaseDistro contains WebServer and Database.  
* DevDistro sets its templateFqn to 'BaseDistro'.  
* An asset of type **InheritanceSuppressor** is created with the FQN DevDistro::Database.

    (Template)                                (Instance)  
\+------------------+                      \+------------------+  
|     BaseDistro      |                      |      DevDistro      |  
\+--------+---------+                      | (templateFqn:    |  
         |                                |    'BaseDistro')    |  
         |-- (has child) \--\> \+----------+  \+--------+---------+  
         |                   | WebServer|           |  
         |                   \+----------+           |-- (has child) \--\> \+----------------+  
         |                                          |                   |    Database    | (SUPPRESSOR)  
         \`-- (has child) \--\> \+----------+           |                   \+----------------+  
                             | Database |           |  
                             \+----------+           \`-- (Inherits \`WebServer\` but \`Database\` is blocked by suppressor)

# **Inheritance Suppressor**

Version: 1.0  
Date: October 14, 2025  
Author: Gemini  
Status: Implemented

### **1\. The Challenge: Removing Inherited Structure**

In a system that uses **structural inheritance**, a parent asset (e.g., ProductionDistro) can inherit a collection of child assets (e.g., WebServer, Database) from a template (e.g., BaseDistro). This is incredibly powerful for establishing consistent patterns and reducing duplication.

However, this raises a critical question: **How** do you safely **and clearly state that a specific child asset from the template should *not* exist in the inheriting asset?**

For example, if BaseDistro provides a WebServer and a Database, how do we create a DatabaseOnlyDistro that inherits the Database but explicitly *removes* the WebServer?

Initial ideas, such as using an "empty override" (a local asset with no configuration), proved to be unsafe. Their meaning was implicit and context-dependent. If the template changed, an empty asset intended to suppress inheritance could silently transform into a "marker" asset, creating unexpected behavior. This violates the principle of predictable and stable configuration.

### **2\. The Solution: Explicit Declaration via the InheritanceSuppressor**

To solve this, we introduce the **InheritanceSuppressor**: a dedicated, special-purpose asset type whose sole function is to declare the intent to block an inherited asset.

This model moves away from implicit conventions and towards **explicit declaration**. The InheritanceSuppressor is not a configuration item; it is a **command**. Its very presence in the asset tree is a direct instruction to the Resolution Engine.

### **3\. Core Principles**

#### **3.1. Unambiguous Intent**

An InheritanceSuppressor has only one purpose: to prevent an asset with a matching assetKey from being inherited. It cannot be misinterpreted as a "marker" or an incompletely configured asset. Its name and distinct icon (mdi-link-off) immediately communicate its function to any user browsing the asset tree.

#### **3.2. Safety and Stability**

The meaning of an InheritanceSuppressor is **atomic and context-independent**. It does not depend on the state of the templates it is overriding.

* If you create a suppressor for WebServer, it will block an inherited WebServer.  
* If the template is later changed to no longer include a WebServer, the suppressor simply does nothing. It does not magically transform into a real WebServer.

This prevents silent, unintended changes in behavior and makes the system far more robust and predictable, especially during template refactoring.

#### **3.3. Discoverability and Self-Documentation**

By being a real, visible asset in the main Explorer Tree, the InheritanceSuppressor serves as its own documentation. When a developer looks at the structure of DatabaseOnlyDistro, they will see:

* DatabaseOnlyDistro  
  * WebServer (Inheritance Suppressor)

This immediately tells them, "This distro is based on a template, but the WebServer has been explicitly removed." There is no need to cross-reference templates to understand why a component is missing from the final merged view. The override logic is visible at a glance.

### **4\. How It Works**

The implementation is a clean separation of user action and engine logic.

#### **4.1. The User's Action**

To remove an inherited asset (e.g., WebServer from BaseDistro), the user performs a single, explicit action:

1. They create a **new asset** as a child of their distro (e.g., DatabaseOnlyDistro).  
2. They select the asset type **InheritanceSuppressor**.  
3. They give it an assetKey that **exactly matches** the assetKey of the inherited asset they wish to block (i.e., WebServer).

# **Synergy Guide: Combining Structural & Property Inheritance**

**Objective:** This guide demonstrates how to combine the system's two inheritance models—**Structural** and **Property**—to build sophisticated, layered configurations. Understanding how these two systems interact is the key to mastering the asset editor.

**Prerequisites:** This guide assumes you have a conceptual understanding of the two core inheritance models. For a detailed explanation, please refer to:

* **Conceptual Document: Structural Inheritance**  
* **Conceptual Document: Property Inheritance**

### **1\. The Two-Layer Inheritance Model**

The most effective way to think about the system is as a two-layer model. The engine always resolves the first layer completely before the second layer comes into play.

Layer 1: Structural Inheritance (The "What")

This layer assembles the final collection of child assets for a parent. It is controlled by the parent's templateFqn and uses the child's assetKey to handle overrides. It determines what components a system is made of.

Layer 2: Property Inheritance (The "How")

This layer calculates the final configuration properties for each individual asset in that final collection. It is controlled by the child's own templateFqn. It determines how each of those components is configured.

This guide will walk through a practical example showing this two-layer process in action.

### **2\. Real-World Scenario: Staging vs. Production**

Let's design a common real-world setup.

The Goal:

We need to manage a Staging and a Production distro. They are mostly identical, but the production web server needs a different port and a larger disk size. All web servers, regardless of distro, should share a base set of security settings.

**The Assets:**

* GlobalSecurityTemplate (Package): A property template.  
* StandardWebServer (Package): A property template.  
* BaseDistro (Distro): A **structural** template.  
* StagingDistro (Distro): An instance that will use simple structural inheritance.  
* ProductionDistro (Distro): An instance that will use structural inheritance with an override.

### **3\. Step-by-Step Implementation**

#### **Step 3.1: Create the Property Templates**

These templates define the "how" for individual components.

1. **Create GlobalSecurityTemplate:**  
   * Type: Package, assetKey: GlobalSecurityTemplate  
   * overrides: { "security\_level": "high" }  
2. **Create StandardWebServer:**  
   * Type: Package, assetKey: StandardWebServer  
   * **templateFqn**: GlobalSecurityTemplate *(Property Inheritance link)*  
   * overrides: { "port": 8080, "disk": "100GB" }

#### **Step 3.2: Create the Structural Template (BaseDistro)**

This template defines the "what" – the layout of a standard distro.

1. **Create BaseDistro:**  
   * Type: Distro, assetKey: BaseDistro  
2. **Add a Child to BaseDistro:**  
   * Create a Package with assetKey: WebServer.  
   * Set its templateFqn to StandardWebServer.  
   * Its full FQN is BaseDistro::WebServer.

**After these steps, your full template structure in the Explorer Tree looks like this:**

(Full Asset Tree \- Templates)

\+ GlobalSecurityTemplate (Package)  
\+ StandardWebServer (Package)  
|  \`-- (templateFqn: 'GlobalSecurityTemplate')  
|  
\+ BaseDistro (Distro)  
   \`--+ WebServer (Package)  
      \`-- (templateFqn: 'StandardWebServer')

#### **Step 3.3: Create StagingDistro (Simple Structural Inheritance)**

1. **Create and Link StagingDistro:**  
   * Type: Distro, assetKey: StagingDistro  
   * **templateFqn**: BaseDistro *(Structural Inheritance link)*

Analysis for StagingDistro:

The explicit asset tree only contains the StagingDistro asset itself.

(Explorer Tree View)  
\+ StagingDistro (Distro)

Inside its **"Merged View"**, the two-layer process occurs:

1. **Structural Merge:** The engine finds no local children in StagingDistro, so it inherits the WebServer from the BaseDistro template. The final child list is \[WebServer\].  
2. **Property Merge:** When that WebServer is inspected, its properties are calculated by merging GlobalSecurityTemplate \-\> StandardWebServer.

**The resulting "Merged View" for StagingDistro will be rendered as:**

(StagingDistro Merged View)

\+ Merged View (Virtual Folder)  
  \`--+ Packages (Virtual Sub-Folder)  
     \`--+ WebServer (Read-only Alias)

* **Final Properties of WebServer:** { "security\_level": "high", "port": 8080, "disk": "100GB" }

#### **Step 3.4: Create ProductionDistro (Structural Inheritance with an Override)**

Here, we define a local WebServer to shadow the inherited one.

1. **Create and Link ProductionDistro:**  
   * Type: Distro, assetKey: ProductionDistro  
   * **templateFqn**: BaseDistro  
2. **Create the Explicit Override:**  
   * Create a new Package as a child of ProductionDistro.  
   * **assetKey**: WebServer ***(This is the crucial link that shadows the inherited asset)***  
   * **templateFqn**: StandardWebServer *(The local override still uses the same property template)*  
   * overrides: { "port": 443, "disk": "500GB\_SSD" }

Analysis for ProductionDistro:

The explicit asset tree now clearly shows your intent to override the WebServer.

(Explorer Tree View)  
\+ ProductionDistro (Distro)  
|  
\`--+ WebServer (Package, The Override)

##### **The Shadowing Mechanism: assetKey is the Key**

The override works because the Resolution Engine prioritizes local assets. It uses the **assetKey** to identify which inherited assets have been "shadowed" or replaced.

Resolution for 'ProductionDistro':

1\. Find local children:  
   \- Found one: \`ProductionDistro::WebServer\`  
   \- Its \`assetKey\` is "WebServer".

2\. Add to final collection map:  
   \- collection\['WebServer'\] \= \`ProductionDistro::WebServer\`

3\. Look at template \`BaseDistro\`:  
   \- Find inherited child: \`BaseDistro::WebServer\`  
   \- Its \`assetKey\` is "WebServer".

4\. Check collection map:  
   \- Is the key 'WebServer' already present? YES.  
   \- Action: \*\*DISCARD\*\* the inherited asset.

This "local wins" logic, based on matching the **assetKey**, is what allows you to precisely replace parts of an inherited structure.

**Now, let's look inside its "Merged View"**:

1. **Structural Merge:** The engine starts with ProductionDistro. It finds your **local WebServer override first**. Because its assetKey matches the assetKey of the child in BaseDistro, the inherited asset is discarded. The final list of children is just \[your local WebServer\].  
2. **Property Merge:** When this local WebServer is inspected, its properties are calculated by merging GlobalSecurityTemplate \-\> StandardWebServer \-\> ProductionDistro::WebServer.

**The resulting "Merged View" for ProductionDistro will be rendered as:**

(ProductionDistro Merged View)

\+ Merged View (Virtual Folder)  
  \`--+ Packages (Virtual Sub--Folder)  
     \`--+ WebServer (Read-only Alias to Local Override)

* **Final Properties of WebServer:** { "security\_level": "high", "port": 443, "disk": "500GB\_SSD" } (The local values win).

---

### **4\. Practical Use Cases**

Here are several common, real-world scenarios where these inheritance models provide significant value:

#### **Use Case 1: Multi-Region Deployments**

* **Scenario:** You need to deploy your application to multiple geographic regions (US-East, EU-West, Asia-Pacific). The core infrastructure (the list of servers, databases, etc.) is identical in every region, but specific properties like network endpoints or resource sizes must change.  
* **Primary Model Used:** **Structural Inheritance**.  
* **Implementation:**  
  1. Create a single structural template, BaseRegionDistro, that contains all the standard Node and Package assets.  
  2. Create three new distros: US-East-Distro, EU-West-Distro, and Asia-Pacific-Distro. All three set their templateFqn to BaseRegionDistro.  
  3. In each specific region distro, you create a small number of local override assets (e.g., an Option asset named RegionConfig) to specify the unique endpoints for that region.  
* **Benefit:** You have a single source of truth for your infrastructure layout. Adding a new LoggingService to all regions requires adding it only once to BaseRegionDistro.

#### **Use Case 2: Tiered Service Levels (Free vs. Pro)**

* **Scenario:** You offer a "Free" and a "Pro" tier for your application. The underlying WebServer package is the same software, but the Pro tier gets more CPU, more memory, and has a different license key.  
* **Primary Model Used:** **Property Inheritance**.  
* **Implementation:**  
  1. Create a BaseWebServer property template with all the common settings.  
  2. Create a FreeTierConfig template that inherits from BaseWebServer and sets { "cpu": "1c", "memory": "2GB" }.  
  3. Create a ProTierConfig template that also inherits from BaseWebServer but sets { "cpu": "4c", "memory": "16GB", "license\_key": "PRO-XXXX" }.  
  4. In your distros, you can now create WebServer packages that point their templateFqn to either FreeTierConfig or ProTierConfig.  
* **Benefit:** You can manage the resource allocations for your service tiers from a central location. Changing the memory for all Pro users is a single edit.

#### **Use Case 3: A/B Testing or Feature Flags**

* **Scenario:** You want to test a new, experimental AnalyticsService in your production distro, but only for a small subset of users. You need an distro that is identical to production but *without* the standard, old AnalyticsService.  
* **Primary Model Used:** **Structural Inheritance with a Suppressor**.  
* **Implementation:**  
  1. Your ProductionDistro inherits its structure from BaseDistro, which includes an AnalyticsService package.  
  2. Create a new distro, AnalyticsTestDistro, and set its templateFqn to ProductionDistro (or BaseDistro).  
  3. Inside AnalyticsTestDistro, create a single new asset: an **InheritanceSuppressor** with the assetKey AnalyticsService.  
  4. You can then add your new, experimental NewAnalyticsService package to the AnalyticsTestDistro.  
* **Benefit:** You have created a near-perfect clone of production while surgically removing one component, ensuring a clean and isolated test distro. This is far safer than manually managing a separate, divergent configuration.

#### **Use Case 4: Emergency Hotfix Patching**

* **Scenario:** A critical vulnerability is found in your Nginx package (version 1.21.0). You have a patched version, 1.21.1, that needs to be deployed immediately to production, but you don't want to change the standard templates yet.  
* **Primary Model Used:** **Property Inheritance with a local override**.  
* **Implementation:**  
  1. Your ProductionDistro has a WebServer that ultimately inherits its properties from StandardWebServer, which specifies { "version": "1.21.0" }.  
  2. You edit the explicit ProductionDistro::WebServer override asset.  
  3. You add a single property to its overrides: { "version": "1.21.1" }.  
* **Benefit:** You have made a precise, surgical change to a single property in a single distro without touching any of the underlying templates. The change is clearly visible as a local override, making it easy to track and revert after the emergency is over.
