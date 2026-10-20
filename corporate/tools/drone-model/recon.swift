// Photogrammetry of the drone frames with RealityKit Object Capture (macOS 26+,
// Apple silicon). Build: swiftc -O -swift-version 5 recon.swift -o recon-tool
// Usage: recon-tool <framesDir> <outDir> [maxPolygons]
// Writes:
//   outDir/model/        textured OBJ (custom detail, maxPolygons, 8K texture)
//   outDir/model-lite/   textured OBJ (reduced detail) for the wireframe overlay
//   outDir/poses.json    per-frame camera pose, intrinsics, lens distortion
//   outDir/points.ply    reconstructed point cloud (binary PLY, xyz + rgb)
import Foundation
import RealityKit

setvbuf(stdout, nil, _IONBF, 0)
let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: recon-tool <framesDir> <outDir> [maxPolygons]")
    exit(2)
}
let input = URL(fileURLWithPath: args[1], isDirectory: true)
let output = URL(fileURLWithPath: args[2], isDirectory: true)
let maxPolygons = args.count > 3 ? UInt(args[3]) ?? 400_000 : 400_000
let fm = FileManager.default
let modelDir = output.appendingPathComponent("model", isDirectory: true)
let liteDir = output.appendingPathComponent("model-lite", isDirectory: true)
for d in [output, modelDir, liteDir, output.appendingPathComponent("checkpoint", isDirectory: true)] {
    try fm.createDirectory(at: d, withIntermediateDirectories: true)
}

var config = PhotogrammetrySession.Configuration()
config.sampleOrdering = .sequential      // frames come from one continuous flight
config.featureSensitivity = .high
config.isObjectMaskingEnabled = false    // a scene, not an object on a turntable
config.checkpointDirectory = output.appendingPathComponent("checkpoint", isDirectory: true)
if ProcessInfo.processInfo.environment["RECON_IGNORE_BOUNDS"] == "1" { config.ignoreBoundingBox = true }
var custom = PhotogrammetrySession.Configuration.CustomDetailSpecification()
custom.maximumPolygonCount = maxPolygons
custom.maximumTextureDimension = .eightK
custom.outputTextureMaps = [.diffuseColor]
custom.textureFormat = .jpeg(compressionQuality: 0.92)
config.customDetailSpecification = custom

let session = try PhotogrammetrySession(input: input, configuration: config)
let started = Date()
print("session started: \(input.path) → \(output.path), maxPolygons \(maxPolygons)")

func writePoses(_ poses: PhotogrammetrySession.Poses) throws {
    var list: [[String: Any]] = []
    let urls = poses.urlsBySample
    for (sample, pose) in poses.posesBySample.sorted(by: { $0.key < $1.key }) {
        let q = pose.rotation.vector
        var entry: [String: Any] = [
            "sample": sample,
            "file": urls[sample]?.lastPathComponent ?? "",
            "t": [pose.translation.x, pose.translation.y, pose.translation.z],
            "q": [q.x, q.y, q.z, q.w],
        ]
        if let k = pose.intrinsics {
            // simd_float3x3 is column-major: columns 0…2
            entry["K"] = [[k.columns.0.x, k.columns.0.y, k.columns.0.z],
                          [k.columns.1.x, k.columns.1.y, k.columns.1.z],
                          [k.columns.2.x, k.columns.2.y, k.columns.2.z]]
        }
        if let d = pose.lensDistortionData {
            entry["distortion"] = ["center": [d.center.x, d.center.y], "lut": d.radialLookupTable]
        }
        list.append(entry)
    }
    let data = try JSONSerialization.data(withJSONObject: ["poses": list], options: [.sortedKeys])
    try data.write(to: output.appendingPathComponent("poses.json"))
    print("poses: \(list.count) samples written")
}

func writePoints(_ cloud: PhotogrammetrySession.PointCloud) throws {
    let pts = cloud.points
    var header = "ply\nformat binary_little_endian 1.0\nelement vertex \(pts.count)\n"
    header += "property float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n"
    var data = Data(header.utf8)
    data.reserveCapacity(data.count + pts.count * 15)
    for p in pts {
        var x = p.position.x, y = p.position.y, z = p.position.z
        withUnsafeBytes(of: &x) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &y) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &z) { data.append(contentsOf: $0) }
        data.append(contentsOf: [p.color.x, p.color.y, p.color.z])
    }
    try data.write(to: output.appendingPathComponent("points.ply"))
    print("points: \(pts.count) written")
}

try session.process(requests: [
    .poses,
    .pointCloud,
    .modelFile(url: liteDir, detail: .reduced),
    .modelFile(url: modelDir, detail: .custom),
])

var lastPrinted: [String: Int] = [:]
var failed = false
for try await out in session.outputs {
    switch out {
    case .inputComplete:
        print("input complete (\(Int(Date().timeIntervalSince(started)))s)")
    case .requestProgress(let req, let fraction):
        let key = "\(req)"
        let pct = Int(fraction * 100)
        if pct / 5 != (lastPrinted[key] ?? -1) / 5 {
            lastPrinted[key] = pct
            print("progress \(pct)% (\(Int(Date().timeIntervalSince(started)))s)")
        }
    case .requestProgressInfo(_, _):
        break
    case .requestComplete(let req, let result):
        switch result {
        case .poses(let poses): try writePoses(poses)
        case .pointCloud(let cloud): try writePoints(cloud)
        case .modelFile(let url): print("model written: \(url.path)")
        default: print("request complete: \(req)")
        }
    case .requestError(let req, let error):
        failed = true
        print("REQUEST ERROR \(req): \(error)")
    case .processingComplete:
        print("processing complete in \(Int(Date().timeIntervalSince(started)))s")
    case .invalidSample(let id, let reason):
        print("invalid sample \(id): \(reason)")
    case .skippedSample(let id):
        print("skipped sample \(id)")
    case .automaticDownsampling:
        print("note: automatic downsampling applied")
    case .stitchingIncomplete:
        print("WARNING: stitching incomplete (not all frames could be joined)")
    case .processingCancelled:
        print("processing cancelled")
        failed = true
    @unknown default:
        print("output: \(out)")
    }
}
exit(failed ? 1 : 0)
