const std = @import("std");

const version = std.SemanticVersion{ .major = 0, .minor = 0, .patch = 0 };
const version_date = "03-09-2024";
const description = "Compiler for the Ruka Programming Language";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    // Dependencies
    const clap = b.dependency("clap", .{});
    const chrono = b.dependency("chrono", .{});

    const optimize = b.standardOptimizeOption(.{});

    const root = b.addStaticLibrary(.{
        .name = "rukac",
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    root.root_module.addImport("chrono", chrono.module("chrono"));

    b.installArtifact(root);

    const exe = b.addExecutable(.{
        .name = "rukac",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    exe.root_module.addImport("rukac", &root.root_module);
    exe.root_module.addImport("clap", clap.module("clap"));

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

    const lib_unit_tests = b.addTest(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .test_runner = b.path("tests/test_runner.zig"),
        .optimize = optimize,
    });

    const run_lib_unit_tests = b.addRunArtifact(lib_unit_tests);
    run_lib_unit_tests.addArg("--suite Library");

    const exe_unit_tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .test_runner = b.path("tests/test_runner.zig"),
        .optimize = optimize,
    });

    const run_exe_unit_tests = b.addRunArtifact(exe_unit_tests);
    run_exe_unit_tests.addArg("--suite Executable");

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_lib_unit_tests.step);
    test_step.dependOn(&run_exe_unit_tests.step);
}
