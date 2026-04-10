# Statements
Statements end with newlines
# Blocks
Blocks are enclosed with `do...end` for multiline blocks and with `=>` for singleline blocks
# Comments
```
// Comments are written with double slashes
```
# Variables
Variables can be declared with the let = initial value statement
```
let x = 12
```
# Constants
Constants can be declared with the `const = value` or `local = value` statements. `const` are public and `local` are private
```
local x = 12
const y = 13
```
# Literals
```
let name = "World"                    // string
let story = |"
			| This is a multiline string
			|"
let greeting = "Hello, {name}"        // String interpolation
let day = 12                          // usize is the default integer size
let is_okay = false                   // boolean
let flags = 0b00010010                // usize binary literal
let time = 34.21                      // float
let coord = .[12, 23]                 // tuple
let items = .{1, 2, 4}                // array
let things = .{                       // hashmap usize, usize
	1 = 12,
	2 = 31,
	4 = 14
}
let vector = .{                       // record literal
	x = 12,
	y = 51,
	z = 55
}
let thing: option(usize) = .some(12)  // builtin option variant definition
```
# Operators
```
```
# Conditionals
Logical operations are done with the `and`, `or`, and `not` keywords
```
if condition do
	// Some code
else if not condition do
	// Some code
else if condition and condition do
	// Some code
else if condition or condition do
	// Some code
end
```
# Matching
```
match x with
	12 do
		// Some code
	end
	13 do
		// Some code
	end
	x < 5 => // Some code
	else => // Some code
end
```
# Loops
```
while condition do
	// Some code
end

for x in container do
	// Some code
end
```
# Functions
Functions are declared by storing an anonymous function in a public or private constant. Final expression is returned from the function, can return early with `return` keyword. Builtin functions start with `@`.
```
local hello = (name: string) do
	"Hello, {name}"
end

local abs = (x) => @abs(x)

local main = () do
	@println(hello())
end
```
# Builtin types and how their specified
string, boolean, option (some or none), result (ok, error), float (system size floats), f{bits} (variable sized float), usize / isize (system size integers), u{bits} / i{bits} (variable sized integer), hashmap `[key: value]`, array `[element]`, tuple `[a, b, c]`
```
let name: string = "World"
```
# User types
User types are defined by storing a type literal in a constant. Types use braces to enclose their definiton
```
//
local Vector = record {
	x: usize,
	y: usize,
	// Can make private fields
	local z: usize
}

// Tagged union / enumeration type
local Dog = variant {
	some: usize,
	none: unit
}

local Cat = record {
	name: string,
	colour: variant {
		black,
		white,
		grey
	}
}
```
# Static functions
Static functions are declared by adding a reciever to the constant declaration which contains the type it will be a part of
```
local Vector = record {
	x: usize,
	y: usize
}

const new (Vector) = (x, y) do
	.{ x, y }
end

local main = () do
	local coord = Vector.new(12, 43)
end
```
# Methods
Methods are declared similarly to the static functions but the reciever must be given a name
```
local Vector = record {
	x: usize,
	y: usize
}

// local would result in a private method
const add (self: Vector) = (other: Vector) do
	.{
		x = self.x + other.x,
		y = self.y + other.y
	}
end

local sub = (a: Vector, b: Vector) do
	.{
		x = a.x - b.x,
		y = a.y - b.y
	}
end

local main = () do
	let a = Vector .{ x = 0, y = 1 }

	let b: Vector = .{x = 1, y = 0 }

	let c = a.add(b)
end
```
# Modules
```
local Array = module {
	const t = record {
		buf: [usize]
	}

	// All structure / collection literals start with `.`, and empty `.{}` is interpreted as an empty array, records require at least one field. Record type must be specified if ambiguous
	const new = () do
		t.{ buf: .{} }
	end
}

local main = () do
	let stuff = Array.new()
end
```