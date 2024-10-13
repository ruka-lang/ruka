const std = @import("std");

const version = std.SemanticVersion{ .major = 0, .minor = 0, .patch = 0 };
const version_date = "09-30-2024";
const description = "Compiler for the Ruka Programming Language";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const optimize = b.standardOptimizeOption(.{});

    const root = b.addStaticLibrary(.{
        .name = "ruka",
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    //b.installArtifact(root);

    const exe = b.addExecutable(.{
        .name = "ruka",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    exe.root_module.addImport("ruka", &root.root_module);

    b.installArtifact(exe);

    var options = b.addOptions();
    options.addOption(std.SemanticVersion, "version", version);
    options.addOption([]const u8, "version_date", version_date);
    options.addOption([]const u8, "description", description);
    exe.root_module.addOptions("options", options);

    const run_cmd = b.addRunArtifact(exe);

    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    const coverage = b.option(bool, "test-coverage", "Generate test coverage") orelse false;

    const lib_unit_tests = b.addTest(.{
        .name = "lib_test",
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .test_runner = b.path("tests/test_runner.zig"),
        .optimize = optimize,
    });

    const bin_unit_tests = b.addTest(.{
        .name = "bin_test",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .test_runner = b.path("tests/test_runner.zig"),
        .optimize = optimize,
    });
    bin_unit_tests.root_module.addImport("ruka", &root.root_module);

    if (coverage) {
        var buf: [4096]u8 = undefined;
        const cwd = std.posix.getcwd(&buf) catch |err| {
            std.debug.print("{}\n", .{err});
            return;
        };
        const include = std.fmt.bufPrint(
            buf[cwd.len..],
            "--include-path={s}",
            .{cwd}
        ) catch |err| {
            std.debug.print("{}\n", .{err});
            return;
        };

        lib_unit_tests.setExecCmd(&.{
            "kcov",
            "--clean",
            include,
            ".kcov-output",
            null
        });
        lib_unit_tests.test_runner = null;

        bin_unit_tests.setExecCmd(&.{
            "kcov",
            "--clean",
            include,
            ".kcov-output",
            null
        });
        bin_unit_tests.test_runner = null;
    }

    const run_lib_unit_tests = b.addRunArtifact(lib_unit_tests);
    const run_bin_unit_tests = b.addRunArtifact(bin_unit_tests);

    if (!coverage) {
        run_lib_unit_tests.addArg("--suite lib");
        run_bin_unit_tests.addArg("--suite bin");
    }

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_lib_unit_tests.step);
    test_step.dependOn(&run_bin_unit_tests.step);
}
