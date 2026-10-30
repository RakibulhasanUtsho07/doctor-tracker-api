# ADR-003: Data model and indexes
Status: Proposed; patient field list pending clarification.
Use users, doctors and patients collections; patient references doctor by ObjectId. Derive indexes from actual filter/sort/aggregate access patterns and validate via explain plans with synthetic data. Confirm patient fields, condition vocabulary and delete-vs-detach semantics before schema freeze.
