- Iterating over record and variant fields and applying conditions to them
- Can compare something to a type or behaviour and capture as a variable
```
let tree = .{ left = Node.new(), right = Node.new(), nodes = 2 }
let sum = 0
for Node(n) in tree do
	sum = sum + n.x
	// Only runs for left and right
end
```
- Things like about will be inlined in compilation
- Iterating over type fields, methods, statics at compile time (allowing rust like derive functions)
- Fields refer to runtime instance attributes, statics refer to compile time shared attributes
- Behaviours can only be used in parameters