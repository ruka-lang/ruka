```
/project                  !! Required
    /.build               -- Build artifacts and package cache, can be ignored in version control
    /src                  !! Required
        main.ruka         !! Required, entry point of executable
        root.ruka         !! Required (if creating a package to share), entry point of a ruka package. Controls the package's public API.
        etc.ruka          -- Source files used for the project
        ...
        /module           --
            root.ruka     !! Required, module entry point, used like a mod.rs in Rust
            etc.ruka      -- Source files used for the module
            ...
            /submodule    --
                root.ruka !! Required, submodule entry point, used like a mod.rs in Rust
                etc.ruka  -- Source files used for the submodule
                ...
    build.ruka            !! Required, project metadata and configuration
  ```
