functions:
- @print()
- @println(string)
- @import(string)
- @typeOf('a)
-
types:
- uint
- u# # arbitray size unsigned integer
- int
- i# # arbitray size signed integer
- float
- f# # arbitrary size float
- string
- bool
- unit or ()
- type
- pointer
    - annotation: *type
- reference
    - annotation: &type
- function
    - annotation: (parameters) -> return
    - instance: (parameters) -> return {
      code
    }
    - one-liner: (parameters) -> return => code
- closure
    - annotation: (parameters) -> return
    - instance: (parameters) -> return { |captures|
      code
    }
    - one-liner: (parameters) -> return => |captures| code
- array
    - annotation: \[size\]element
    - instance: \[size\]{val, ...}
- static map
    - annotation: \[key, value\]
    - instance: \[key, value\]{key: val, ...}
- tuple
    - annotation: tuple {type, type, ...}
    - instance: {val, val, ...}
- record
    - annotation: record {field: type, field: type, ...}
    - instance: {field: val, field: val, ...}
- variant (tagged union)
    - annotation: variant {name: type, name: type, ...}
    - instance: variant.kind(val)
- literal
    - annotation: literal
    - instance: 'identifier
        - 'a
        - 'fast
