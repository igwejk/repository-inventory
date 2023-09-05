# Repository Inventory for Migration

This solution will generate an inventory of repositories in a GitHub enterprise account.

## Prerequisite

A `nodejs` runtime is required for running the solution. Recommended version is `>=v18.13.0`

## Usage

1. **Install dependencies**

   ```bash
   cd/path/to/repository-inventory
   npm install
   ```

2. **Set parameters**

   Parameters are passed as environment variable. Before executing the solution, the parameters may be set as follows.

   ```bash
   # These are the minimum required parameters that must be provided.
   export GITHUB_TOKEN=<PAT>
   export GITHUB_HOST=<HOSTNAME>
   
   # Optional parameters
   export GITHUB_ENTERPRISE_SLUG=github
   export REPOSITORY_INVENTORY=/path/to/output.csv
   ```

3. **Run the solution**

   ```bash
   cd/path/to/repository-inventory
   node index.js
   ```

   At exit, the script will print an output like the one below

   ```txt
   Wrote repository inventory to /path/to/path/to/repository-inventory/repository-inventory-1690534367507.csv
   ```