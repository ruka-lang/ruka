const std = @import("std");

const ruka_version = std.SemanticVersion{ .major = 0, .minor = 1, .patch = 0, .pre = "dev" };
const version_date = "10-13-2024";
const description = "Build tool/Package manager for the Ruka Programming Language";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Binary
    const bin = b.addExecutable(.{
        .name = "ruka",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize
    });

    const logging = b.option(bool, "logging", "Build executable with logging") orelse false;

    b.installArtifact(bin);

    var options = b.addOptions();
    options.addOption(std.SemanticVersion, "semver", getVersion(b));
    options.addOption([]const u8, "build_date", getDate(b));
    options.addOption([]const u8, "description", description);
    options.addOption(bool, "logging", logging);
    bin.root_module.addOptions("options", options);

    const run_cmd = b.addRunArtifact(bin);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // Tests
    const ruka_unit_tests = b.addTest(.{
        .name = "ruka_test",
        .root_source_file = b.path("src/prelude.zig"),
        .target = target,
        .test_runner = .{ .path = .{ .src_path = .{ .owner = b, .sub_path = "runners/test.zig" }}, .mode = .simple },
        .optimize = optimize,
    });

    const run_bin_unit_tests = b.addRunArtifact(ruka_unit_tests);
    run_bin_unit_tests.addArg("--suite bin");

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_bin_unit_tests.step);

    // Coverage
    const coverage_step = b.step("coverage", "Generate test coverage");

    const merge_step = std.Build.Step.Run.create(b, "merge coverage");
    merge_step.addArgs(&.{ "kcov", "--merge" });
    merge_step.rename_step_with_output_arg = false;
    const merged_coverage_output = merge_step.addOutputFileArg(".");

    const kcov_collect = std.Build.Step.Run.create(b, "collect bin coverage");
    kcov_collect.addArgs(&.{ "kcov" });
    kcov_collect.addPrefixedDirectoryArg("--include-pattern=", b.path("src"));
    merge_step.addDirectoryArg(kcov_collect.addOutputFileArg(ruka_unit_tests.name));
    kcov_collect.addArtifactArg(ruka_unit_tests);
    kcov_collect.enableTestRunnerMode();

    const install_coverage = b.addInstallDirectory(.{
        .source_dir = merged_coverage_output,
        .install_dir = .{ .custom = "coverage" },
        .install_subdir = ""
    });
    coverage_step.dependOn(&install_coverage.step);
}

fn getVersion(b: *std.Build) std.SemanticVersion {
    if (ruka_version.pre == null and ruka_version.build == null) return ruka_version;

    var code: u8 = undefined;
    const git_describe_untrimmed = b.runAllowFail(
        &.{ "git", "-C", b.pathFromRoot("."), "describe", "--match", "*.*.*", "--tags" },
        &code,
        .Ignore,
    ) catch return ruka_version;

    const git_describe = std.mem.trim(u8, git_describe_untrimmed, " \n\r");

    switch (std.mem.count(u8, git_describe, "-")) {
        0 => {
            // Tagged release (e.g. 0.1.0).
            std.debug.assert(std.mem.eql(u8, git_describe, b.fmt("{}", .{ruka_version})));
            return ruka_version;
        },
        2 => {
            // Untagged development build (e.g. 0.10.0-dev.216+34ce200).
            var it = std.mem.splitScalar(u8, git_describe, '-');
            const tagged_ancestor = it.first();
            const commit_height = it.next().?;
            const commit_id = it.next().?;

            const ancestor_ver = std.SemanticVersion.parse(tagged_ancestor) catch unreachable;
            std.debug.assert(ruka_version.order(ancestor_ver) == .gt);
            std.debug.assert(std.mem.startsWith(u8, commit_id, "g"));

            return std.SemanticVersion{
                .major = ruka_version.major,
                .minor = ruka_version.minor,
                .patch = ruka_version.patch,
                .pre = b.fmt("dev.{s}", .{commit_height}),
                .build = commit_id[1..],
            };
        },
        else => {
            std.debug.print("Unexpected 'git describe' output: '{s}'\n", .{git_describe});
            std.process.exit(1);
        },
    }
}

fn getDate(b: *std.Build) []const u8 {
    var code: u8 = undefined;
    const date_untrimmed = b.runAllowFail(&.{
        "date", "+'%m/%d/%Y'"
    }, &code, .Ignore) catch return version_date;
    const date = std.mem.trim(u8, date_untrimmed, " \n\r");

    return date;
}
