```
/project                  !! Required
    /.build               -- Build artifacts and package cache, can be ignored in version control
    /src                  !! Required
        main.ruka         !! Required, entry point of executable
        mod.ruka          !! Required (if creating a package to share), entry point of a ruka package. Controls the package's public API.
        etc.ruka          -- Source files used for the project
        ...
        /module           --
            mod.ruka      !! Required, module entry point
            etc.ruka      -- Source files used for the module
            ...
            /submodule    --
                mod.ruka  !! Required, submodule entry point
                etc.ruka  -- Source files used for the submodule
                ...
    root.ruka             !! Required, package metadata and configuration
  ```
