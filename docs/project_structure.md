```
/project          !! Required
  /src            !! Required
    /main.ruka    !! Required, entry point of executable
    /root.ruka    !! Required, used like a prelude.rs in Rust
    /a.ruka       -- Source files used for the project
    /b.ruka       --
    /c.ruka       --
    /module       --
      root.ruka   --
      a.ruka      --
      b.ruka      --
      /submodule  --
        root.ruka --
        a.ruka    --
        b.ruka    --
  /build.ruka     !! Required, project metadata and configuration
  ```