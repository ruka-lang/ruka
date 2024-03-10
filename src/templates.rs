pub const CONFIG_TEMPLATE: &str = "
const package = .{
    name: NAME,
    version: \"0.1.0\",
    dependencies: []{
        .{name: \"std\", version: 0.0.0},
    }
}";

pub const IGNORE_TEMPLATE: &str = "
.bulid
";

pub const ENTRY_TEMPLATE: &str = "
/* 
 * Project template
 */

use std

const main = (args: []string) do
    ruka.printf(\"Hello, {}!\\n\", {args[1]})

    return ()
end";
